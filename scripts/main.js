import { MODULE_ID } from "./constants.js";
import {
  registerSettings,
  initializeDefaultCompendiums
} from "./settings.js";
import { MorelordMarketplaceApp } from "./apps/marketplace-app.js";
import { TransactionApprovalService } from "./services/transaction-approval-service.js";
import { Logger } from "./logger.js";
import { EntitlementService } from "./services/entitlement-service.js";

Logger.log("main.js loaded");

Hooks.once("init", async () => {
  Logger.log("Initializing");

  registerSettings();

  await foundry.applications.handlebars.loadTemplates([
    `modules/${MODULE_ID}/templates/parts/buy-tab.hbs`,
    `modules/${MODULE_ID}/templates/parts/sell-tab.hbs`,
    `modules/${MODULE_ID}/templates/marketplace-settings.hbs`
  ]);

  Logger.log("Templates loaded");
});

Hooks.once("ready", async () => {
  Logger.log("Ready");

  await initializeDefaultCompendiums();
  TransactionApprovalService.initialize();

  if (game.user.isGM) {
    await EntitlementService.refresh({ quiet: true });
  }

  game.modules.get(MODULE_ID).api = {
    openMarketplace: () => new MorelordMarketplaceApp().render(true),
    hasPremiumApprovals: () => EntitlementService.hasGmApprovals(),
    refreshEntitlements: options => EntitlementService.refresh(options)
  };

  Logger.log("API registered");
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
});

Hooks.on("updateActor", actor => {
  MorelordMarketplaceApp.refreshForActor(actor);
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

    group.classList.toggle("mlm-premium-setting-locked", !entitled);
    input.disabled = !entitled;

    let badge = group.querySelector(".mlm-premium-setting-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "mlm-premium-setting-badge";
      badge.innerHTML = '<i class="fa-solid fa-crown"></i> Premium';
      group.querySelector("label")?.append(badge);
    }

    badge.hidden = entitled;

    if (!entitled && !group.querySelector(".mlm-premium-setting-message")) {
      const message = document.createElement("p");
      message.className = "hint mlm-premium-setting-message";
      message.innerHTML = 'Connect a Tools Premium or Champion account through Morelord Core to enable GM approvals. <button type="button" class="mlm-inline-account-button"><i class="fa-solid fa-link"></i> Account</button>';
      group.append(message);
      message.querySelector("button")?.addEventListener("click", () => {
        EntitlementService.openAccount();
      });
    }

    if (entitled) {
      group.querySelector(".mlm-premium-setting-message")?.remove();
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
