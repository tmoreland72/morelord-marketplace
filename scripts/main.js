import { MODULE_ID } from "./constants.js";
import {
  registerSettings,
  initializeMarketplaceSources
} from "./settings.js";
import { MorelordMarketplaceApp } from "./apps/marketplace-app.js";
import { MorelordMarketplaceSettingsApp } from "./apps/marketplace-settings-app.js";
import { MorelordShopManagerApp } from "./apps/shop-manager-app.js";
import { ShopService } from "./services/shop-service.js";
import { ActorService } from "./services/actor-service.js";
import { CompendiumService } from "./services/compendium-service.js";
import { TransactionApprovalService } from "./services/transaction-approval-service.js";
import { Logger } from "./logger.js";
import { EntitlementService } from "./services/entitlement-service.js";
import { ShopTransactionService } from "./services/shop-transaction-service.js";
import { WishlistService } from "./services/wishlist-service.js";
import { CurrencyService } from "./services/currency-service.js";

Logger.log("main.js loaded");

Hooks.once("init", async () => {
  Logger.log("Initializing");

  registerSettings();

  await foundry.applications.handlebars.loadTemplates([
    `modules/${MODULE_ID}/templates/parts/buy-tab.hbs`,
    `modules/${MODULE_ID}/templates/parts/sell-tab.hbs`,
    `modules/${MODULE_ID}/templates/parts/wishlist-tab.hbs`,
    `modules/${MODULE_ID}/templates/marketplace-settings.hbs`,
    `modules/${MODULE_ID}/templates/shop-manager.hbs`
  ]);

  Logger.log("Templates loaded");
});

function installShopTokenInteraction() {
  const TokenClass = foundry.canvas.placeables.Token;
  const proto = TokenClass?.prototype;
  if (!proto || typeof proto._onClickLeft2 !== "function") {
    Logger.warn("Unable to install shop token double-click handler: Token._onClickLeft2 not found.");
    return;
  }

  if (proto._onClickLeft2?._mlmShopWrapper) return;

  const originalTokenDoubleClick = proto._onClickLeft2;
  const wrappedShopDoubleClick = function(event) {
    const shop = ShopService.getShopForToken(this);
    if (!shop) return originalTokenDoubleClick.call(this, event);

    event?.preventDefault?.();
    event?.stopPropagation?.();

    // Do not allow Foundry's normal actor-sheet path to race the Marketplace.
    // A shop token always means "open this shop".
    MorelordMarketplaceApp.openShop(shop.id);
    return false;
  };
  Object.defineProperty(wrappedShopDoubleClick, "_mlmShopWrapper", { value: true });
  proto._onClickLeft2 = wrappedShopDoubleClick;
}


function installShopActorSheetRedirect(actor) {
  const ActorClass = foundry.documents.Actor;
  if (!(actor instanceof ActorClass) || !ShopService.getShopForActor(actor)) return;

  const sheet = actor.sheet;
  if (!sheet || typeof sheet.render !== "function") return;
  if (sheet.render?._mlmShopActorRedirect) return;

  const originalRender = sheet.render.bind(sheet);
  const redirectedRender = function(...args) {
    const shop = ShopService.getShopForActor(actor);
    if (!shop) return originalRender(...args);

    // Redirect before Foundry creates or inserts any Actor-sheet HTML. This is
    // deliberately installed on the generated shop Actor as well as on the
    // Token double-click path so another module cannot cause a sheet flash by
    // replacing Token interaction handlers later in startup.
    MorelordMarketplaceApp.openShop(shop.id);
    return sheet;
  };
  Object.defineProperty(redirectedRender, "_mlmShopActorRedirect", { value: true });
  sheet.render = redirectedRender;
}

function installAllShopActorSheetRedirects() {
  for (const actor of game.actors ?? []) installShopActorSheetRedirect(actor);
}

Hooks.once("ready", async () => {
  Logger.log("Ready");

  await initializeMarketplaceSources();

  // Build the global catalog in the background without delaying Foundry's
  // ready sequence. Buy-tab requests reuse this in-flight work or its result.
  void CompendiumService.prewarmIndexes()
    .then(() => CompendiumService.getBuyableCatalog())
    .catch(error =>
      Logger.warn("Unable to prewarm the Marketplace catalog", error)
    );

  TransactionApprovalService.initialize();
  ShopTransactionService.initialize();
  installShopTokenInteraction();

  if (game.user.isGM) {
    await EntitlementService.refresh({ quiet: true });
    await ShopService.ensureAllShopActorAccess();
  }

  installAllShopActorSheetRedirects();

  game.modules.get(MODULE_ID).api = {
    openMarketplace: options => new MorelordMarketplaceApp(options ?? {}).render(true),
    openShop: shopId => MorelordMarketplaceApp.openShop(shopId),
    manageShops: () => {
      if (!EntitlementService.hasShopManager()) { ui.notifications.warn("Shop Manager requires the Marketplace Shop Manager premium feature."); return null; }
      return new MorelordShopManagerApp().render(true);
    },
    hasPremiumApprovals: () => EntitlementService.hasGmApprovals(),
    hasShopManager: () => EntitlementService.hasShopManager(),
    shops: Object.freeze({
      list: () => ShopService.getShops(),
      get: shopId => ShopService.getShop(shopId),
      getEffectiveCapability: shopOrId => ShopService.getEffectiveCapability(
        typeof shopOrId === "string" ? ShopService.getShop(shopOrId) : shopOrId
      ),
      canNormallyOffer: (shopOrId, rarity) => {
        const shop = typeof shopOrId === "string" ? ShopService.getShop(shopOrId) : shopOrId;
        return ShopService.canNormallyOffer(shop, rarity);
      }
    }),
    sourcing: Object.freeze({
      listWishlist: async actorUuid => {
        const actor = await fromUuid(String(actorUuid ?? ""));
        if (!actor || actor.type !== "character") return [];
        const catalog = await CompendiumService.getBuyableCatalog();
        const catalogByUuid = new Map(catalog.map(row => [row.uuid, row]));
        return WishlistService.getEntries(actor)
          .map(saved => catalogByUuid.get(saved.uuid))
          .filter(row => row?.isMagicItem)
          .filter(row => (CompendiumService.RARITY_DEFINITIONS.find(entry => entry.value === row.rarityKey)?.order ?? Infinity) <= 4)
          .map(row => ({ uuid: row.uuid, packId: row.packId, documentId: row.documentId, name: row.name, img: row.img, rarity: row.rarityKey, rarityLabel: row.rarityLabel, typeLabel: row.typeLabel, source: row.source }));
      },
      randomItems: async ({ maxRarity = "legendary", count = 1, excludeUuids = [] } = {}) => {
        const maximum = CompendiumService.RARITY_DEFINITIONS.find(entry => entry.value === CompendiumService.normalizeRarity(maxRarity))?.order ?? 4;
        const excluded = new Set(Array.from(excludeUuids, String));
        const catalog = await CompendiumService.getBuyableCatalog();
        return catalog
          .filter(row => row.isMagicItem && !excluded.has(row.uuid))
          .filter(row => (CompendiumService.RARITY_DEFINITIONS.find(entry => entry.value === row.rarityKey)?.order ?? Infinity) <= maximum)
          .map(row => ({ row, order: Math.random() }))
          .sort((left, right) => left.order - right.order)
          .slice(0, Math.max(0, Math.floor(Number(count) || 0)))
          .map(({ row }) => ({ uuid: row.uuid, packId: row.packId, documentId: row.documentId, name: row.name, img: row.img, rarity: row.rarityKey, rarityLabel: row.rarityLabel, typeLabel: row.typeLabel, source: row.source }));
      },
      spendInvestment: async ({ actorUuid, amountGp } = {}) => {
        const actor = await fromUuid(String(actorUuid ?? ""));
        const gp = Number(amountGp);
        if (!actor || actor.type !== "character") throw new Error("Sourcing investment requires a character.");
        if (!Number.isFinite(gp) || gp <= 0) throw new Error("Sourcing investment must be positive.");
        await CurrencyService.deductCurrency(actor, Math.round(gp * 100));
        return true;
      },
      availableInvestmentGp: async actorUuid => {
        const actor = await fromUuid(String(actorUuid ?? ""));
        if (!actor || actor.type !== "character") return 0;
        return Math.floor(CurrencyService.currencyToCp(CurrencyService.getCurrency(actor)) / 100);
      },
      refundInvestment: async ({ actorUuid, amountGp } = {}) => {
        const actor = await fromUuid(String(actorUuid ?? ""));
        const gp = Number(amountGp);
        if (!actor || actor.type !== "character" || !Number.isFinite(gp) || gp <= 0) return false;
        await CurrencyService.addCurrency(actor, Math.round(gp * 100));
        return true;
      }
    }),
    refreshEntitlements: options => EntitlementService.refresh(options)
  };

  Logger.log("API registered");
});

Hooks.on("canvasReady", () => {
  installShopTokenInteraction();
  installAllShopActorSheetRedirects();
});

Hooks.on("getSceneControlButtons", controls => {
  const tokenControls = controls.tokens;
  if (!tokenControls) return;

  tokenControls.tools.morelordMarketplace = {
    name: "morelordMarketplace",
    title: "Morelord Marketplace",
    icon: "fa-solid fa-store",
    order: Object.keys(tokenControls.tools).length,
    button: true,
    visible: true,
    onChange: () => new MorelordMarketplaceApp().render(true)
  };

  if (game.user.isGM) {
    tokenControls.tools.morelordMarketplaceShops = {
      name: "morelordMarketplaceShops",
      title: "Manage Marketplace Shops",
      icon: "fa-solid fa-shop",
      order: Object.keys(tokenControls.tools).length,
      button: true,
      visible: true,
      onChange: async () => {
        if (!EntitlementService.hasShopManager()) {
          // Give Morelord Core one opportunity to refresh before denying access.
          await EntitlementService.refresh({ quiet: true });
        }
        if (!EntitlementService.hasShopManager()) {
          ui.notifications.warn("Shop Manager requires Marketplace Premium or Champion access.");
          return;
        }
        new MorelordShopManagerApp().render(true);
      }
    };
  }
});

Hooks.on("renderTokenHUD", (app, html) => {
  const token = app?.object ?? canvas?.tokens?.get?.(app?.document?.id);
  const shop = ShopService.getShopForToken(token);
  if (!shop) return;

  const root = html?.querySelector ? html : html?.[0];
  if (!root || root.querySelector("[data-ml-marketplace-open-shop]")) return;

  const button = document.createElement("div");
  button.className = "control-icon ml-marketplace-token-shop-control";
  button.dataset.mlMarketplaceOpenShop = shop.id;
  button.title = `Shop at ${shop.name}`;
  button.setAttribute("role", "button");
  button.setAttribute("tabindex", "0");
  button.setAttribute("aria-label", button.title);
  button.innerHTML = '<i class="fa-solid fa-cart-shopping"></i>';
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    MorelordMarketplaceApp.openShop(shop.id);
  });
  button.addEventListener("keydown", event => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    button.click();
  });

  const column = root.querySelector(".col.right") ?? root.querySelector(".col.left") ?? root;
  column.append(button);
});

const redirectedShopSheets = new WeakSet();

const redirectShopActorSheet = (app, html) => {
  const actor = app?.actor ?? app?.document ?? app?.object;
  if (!(actor instanceof foundry.documents.Actor)) return;

  const shop = ShopService.getShopForActor(actor);
  if (!shop || redirectedShopSheets.has(app)) return;
  redirectedShopSheets.add(app);

  // A shop token is an interaction point, not a normal NPC sheet. Any Foundry
  // attempt to open the generated actor is redirected into Marketplace instead.
  queueMicrotask(async () => {
    try {
      await app.close?.({ force: true });
    } catch (_) {
      // Some legacy sheets do not accept close options; closing is best effort.
      try { await app.close?.(); } catch (_) {}
    }

    MorelordMarketplaceApp.openShop(shop.id);
  });
};

Hooks.on("renderActorSheetV2", redirectShopActorSheet);
Hooks.on("renderActorSheet", redirectShopActorSheet);
Hooks.on("renderApplicationV2", (app, html) => {
  const actor = app?.actor ?? app?.document ?? app?.object;
  if (actor instanceof foundry.documents.Actor && ShopService.getShopForActor(actor)) {
    redirectShopActorSheet(app, html);
  }
});

Hooks.on("controlToken", () => {
  // Token selection may establish the initial shopper for a newly opened shop,
  // but an open shop's explicit Shopping As selector is authoritative.
});

Hooks.on("updateActor", actor => {
  installShopActorSheetRedirect(actor);
  MorelordMarketplaceApp.refreshForActor(actor);
});

Hooks.on("createActor", actor => {
  queueMicrotask(() => installShopActorSheetRedirect(actor));
});

Hooks.on("updateSetting", setting => {
  if (setting?.key === "dnd5e.packSourceConfiguration") {
    // D&D5e only refreshes its own Compendium Browser when Configure Sources
    // changes. Marketplace keeps separate indexes/catalogs, so invalidate them
    // and refresh every open Marketplace surface before an excluded pack can
    // remain visible in a shop or its inventory picker.
    CompendiumService.clearCache();
    foundry.applications.instances?.forEach(app => {
      if (app instanceof MorelordMarketplaceApp || app instanceof MorelordShopManagerApp) {
        void app.render({ force: true });
      }
    });
    return;
  }

  if (setting?.key === `${MODULE_ID}.shops`) {
    for (const app of MorelordMarketplaceApp.instances) {
      if (app.shopId) void app.refreshShopSnapshot();
    }
  }
});

Hooks.on("createItem", item => {
  if (item.parent) MorelordMarketplaceApp.refreshForActor(item.parent);
});

Hooks.on("updateItem", item => {
  if (item.parent) MorelordMarketplaceApp.refreshForActor(item.parent);
});

Hooks.on("deleteItem", item => {
  if (item.parent) MorelordMarketplaceApp.refreshForActor(item.parent);
});

const prepareApprovalCard = (message, html) => {
  TransactionApprovalService.prepareChatCard(message, html);
};

Hooks.on("renderChatMessageHTML", prepareApprovalCard);
Hooks.on("renderChatMessage", prepareApprovalCard);


function preparePremiumSettings(html) {
  if (!game.user.isGM) return;

  const root = html?.querySelector ? html : html?.[0] ?? null;
  if (!root) return;

  const entitled = EntitlementService.hasGmApprovals();
  const settingNames = [
    `${MODULE_ID}.requireSellApproval`,
    `${MODULE_ID}.requireBuyApproval`
  ];

  for (const name of settingNames) {
    const input = root.querySelector(`[name="${name}"]`);
    if (!input) continue;

    const group = input.closest(".form-group");
    if (!group) continue;

    group.classList.toggle("ml-marketplace-premium-setting-locked", !entitled);
    input.disabled = !entitled;

    let badge = group.querySelector(".ml-marketplace-premium-setting-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "ml-marketplace-premium-setting-badge";
      badge.innerHTML = '<i class="fa-solid fa-crown"></i> Premium';
      group.querySelector("label")?.append(badge);
    }

    badge.hidden = entitled;

    if (!entitled && !group.querySelector(".ml-marketplace-premium-setting-message")) {
      const message = document.createElement("p");
      message.className = "hint ml-marketplace-premium-setting-message";
      message.innerHTML = 'Connect a Tools Premium or Champion account through Morelord Core to enable GM approvals. <button type="button" class="ml-marketplace-inline-account-button"><i class="fa-solid fa-link"></i> Account</button>';
      group.append(message);
      message.querySelector("button")?.addEventListener("click", () => {
        EntitlementService.openAccount();
      });
    }

    if (entitled) {
      group.querySelector(".ml-marketplace-premium-setting-message")?.remove();
    }
  }
}

Hooks.on("renderSettingsConfig", (app, html) => preparePremiumSettings(html));
Hooks.on("renderApplicationV2", (app, html) => {
  if (app?.constructor?.name === "SettingsConfig") {
    preparePremiumSettings(html);
  }
});

Hooks.on("morelordCoreEntitlementsUpdated", productSlug => {
  if (productSlug !== MODULE_ID) return;

  for (const app of Object.values(ui.windows ?? {})) {
    if (app instanceof MorelordMarketplaceSettingsApp) {
      app.render({ force: true });
    }
  }
});

Hooks.on("morelordCoreDisconnected", () => {
  for (const app of Object.values(ui.windows ?? {})) {
    if (app instanceof MorelordMarketplaceSettingsApp) {
      app.render({ force: true });
    }
  }
});
