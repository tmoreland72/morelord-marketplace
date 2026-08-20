import { MODULE_ID } from "../constants.js";
import { ShopService } from "../services/shop-service.js";
import { CompendiumService } from "../services/compendium-service.js";
import { EntitlementService } from "../services/entitlement-service.js";
import { ShopTransactionService } from "../services/shop-transaction-service.js";
import { SHOP_ITEM_OPTIONS, ShopProfileModel, getItemTypesForOptions } from "../models/shop-profile.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MorelordShopManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "morelord-marketplace-shops",
    classes: ["morelord-marketplace", "mlm-shop-manager"],
    tag: "section",
    window: { title: "Marketplace Shops", icon: "fa-solid fa-store", resizable: true },
    position: { width: 1240, height: 820 },
    actions: {
      createShop: MorelordShopManagerApp.createShop,
      createPrefabShop: MorelordShopManagerApp.createPrefabShop,
      selectShop: MorelordShopManagerApp.selectShop,
      saveShop: MorelordShopManagerApp.saveShop,
      deleteShop: MorelordShopManagerApp.deleteShop,
      placeShop: MorelordShopManagerApp.placeShop,
      restockShop: MorelordShopManagerApp.restockShop,
      browseImage: MorelordShopManagerApp.browseImage,
      exportShop: MorelordShopManagerApp.exportShop,
      importShop: MorelordShopManagerApp.importShop,
      openInventoryLookup: MorelordShopManagerApp.openInventoryLookup,
      closeInventoryLookup: MorelordShopManagerApp.closeInventoryLookup,
      addInventoryItem: MorelordShopManagerApp.addInventoryItem,
      adjustInventoryQuantity: MorelordShopManagerApp.adjustInventoryQuantity,
      removeInventoryItem: MorelordShopManagerApp.removeInventoryItem
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/shop-manager.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this.selectedShopId = options.shopId ?? ShopService.getShops()[0]?.id ?? null;
    this.isWorking = false;
    this.workingMessage = "";
    this.inventoryLookupOpen = false;
    this.inventorySearchQuery = "";
    this.draftShop = null;
    this.panelScrollPositions = new Map();
    this.inventorySearchTimer = null;
    this.restoreInventorySearchFocus = false;
  }

  async _prepareContext() {
    for (const panel of this.element?.querySelectorAll?.("[data-mlm-preserve-scroll]") ?? []) {
      this.panelScrollPositions.set(panel.dataset.mlmPreserveScroll, {
        top: panel.scrollTop,
        left: panel.scrollLeft
      });
    }

    const shops = ShopService.getShops();
    const selected = this.draftShop?.id === this.selectedShopId
      ? ShopService.normalizeShop(this.draftShop)
      : ShopService.getShop(this.selectedShopId) ?? shops[0] ?? null;
    if (selected && !this.selectedShopId) this.selectedShopId = selected.id;

    let prefabs = [];
    try {
      prefabs = await ShopService.getPrefabStores();
    } catch (error) {
      console.warn(`[${MODULE_ID}] Unable to load prefab shops`, error);
    }

    const itemTypeOptions = Object.entries(SHOP_ITEM_OPTIONS).map(([key, option]) => ({ key, label: option.label }));
    const rarityOptions = ["common", "uncommon", "rare", "veryrare", "legendary", "artifact"];
    const checked = (values, key) => values?.includes(key);
    let inventory = [];
    let inventorySearchResults = [];
    if (selected) {
      const catalog = await CompendiumService.getBuyableCatalog(selected);
      inventory = catalog
        .filter(row => ShopService.isInStock(selected, row))
        .map(row => {
          const quantity = ShopService.getStock(selected, row);
          return { ...row, quantity, quantityLabel: Number.isFinite(quantity) ? quantity : "∞", finite: Number.isFinite(quantity) };
        });
      const query = this.inventorySearchQuery.trim().toLowerCase();
      if (this.inventoryLookupOpen && query.length >= 2) {
        inventorySearchResults = (await CompendiumService.getInventorySearchCatalog())
          .filter(row => row.name.toLowerCase().includes(query))
          .slice(0, 30);
      }
    }

    const shopCards = shops.map(shop => {
      const preset = ShopService.getPresets().find(entry => entry.key === shop.type);
      const modeLabels = { unlimited: "Unlimited", limited: "Limited", hybrid: "Hybrid" };
      const tags = [
        { label: modeLabels[shop.inventoryMode] ?? "Hybrid", icon: shop.inventoryMode === "unlimited" ? "fa-infinity" : shop.inventoryMode === "limited" ? "fa-boxes-stacked" : "fa-layer-group" },
        ...(shop.allowBuying ? [{ label: "Buy", icon: "fa-cart-shopping" }] : []),
        ...(shop.allowSelling ? [{ label: "Sell", icon: "fa-coins" }] : [])
      ];
      return {
        ...shop,
        selected: shop.id === selected?.id,
        typeLabel: shop.prefabId
          ? "Prefab Store"
          : (preset?.label ?? (shop.type ? shop.type.charAt(0).toUpperCase() + shop.type.slice(1) : "Custom")),
        tags
      };
    });

    return {
      premiumAllowed: EntitlementService.hasShopManager(),
      shops: shopCards,
      selected: selected ? {
        ...selected,
        isDraft: selected.id === this.draftShop?.id,
        itemTypeOptions: itemTypeOptions.map(option => ({ ...option, checked: checked(selected.itemOptions, option.key) })),
        rarityOptions: rarityOptions.map(key => ({ key, checked: checked((selected.rarities ?? []).map(ShopService.normalizeRarity), key), label: key === "veryrare" ? "Very Rare" : key.charAt(0).toUpperCase() + key.slice(1) })),
        reputations: ShopService.getReputationTiers().map(tier => ({ ...tier, selected: tier.key === selected.reputation })),
        inventoryModes: [
          { key: "unlimited", label: "Unlimited Catalog" },
          { key: "limited", label: "Limited Stock" },
          { key: "hybrid", label: "Hybrid" }
        ].map(mode => ({ ...mode, selected: mode.key === selected.inventoryMode })),
        restockRules: [
          { key: "manual", label: "GM Restock" },
          { key: "never", label: "Never" }
        ].map(rule => ({ ...rule, selected: rule.key === selected.restock?.rule })),
        restockBehaviors: [
          { key: "replace", label: "Reroll / replace inventory" },
          { key: "topup", label: "Top up inventory" }
        ].map(behavior => ({ ...behavior, selected: behavior.key === selected.restock?.behavior })),
        inventory,
        inventoryCount: inventory.length
      } : null,
      presets: ShopService.getPresets(),
      prefabs: prefabs.map(prefab => ({
        id: prefab.id,
        name: prefab.name,
        shopkeeper: prefab.shopkeeper,
        matchedCount: prefab.matchedCount,
        totalItems: prefab.totalItems,
        source: prefab.source,
        page: prefab.page
      })),
      isWorking: this.isWorking,
      workingMessage: this.workingMessage || "Working…",
      inventoryLookupOpen: this.inventoryLookupOpen,
      inventorySearchQuery: this.inventorySearchQuery,
      inventorySearchReady: this.inventorySearchQuery.trim().length >= 2,
      inventorySearchResults
    };
  }

  _form() {
    return this.element?.querySelector("form[data-shop-form]");
  }

  _onRender(context, options) {
    super._onRender(context, options);

    for (const panel of this.element.querySelectorAll("[data-mlm-preserve-scroll]")) {
      const key = panel.dataset.mlmPreserveScroll;
      const position = this.panelScrollPositions.get(key);
      if (position) {
        panel.scrollTop = position.top;
        panel.scrollLeft = position.left;
      }
      panel.addEventListener("scroll", () => {
        this.panelScrollPositions.set(key, {
          top: panel.scrollTop,
          left: panel.scrollLeft
        });
      }, { passive: true });
    }

    const search = this.element.querySelector('[name="inventorySearch"]');
    search?.addEventListener("input", event => {
      this.inventorySearchQuery = event.currentTarget.value;
      clearTimeout(this.inventorySearchTimer);
      this.inventorySearchTimer = setTimeout(async () => {
        this.restoreInventorySearchFocus = true;
        await this.render();
      }, 200);
    });

    if (this.restoreInventorySearchFocus && search) {
      search.focus({ preventScroll: true });
      search.setSelectionRange(search.value.length, search.value.length);
      this.restoreInventorySearchFocus = false;
    }
  }

  static async createShop(event, target) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) { ui.notifications.warn("Shop Manager requires a premium Marketplace entitlement."); return; }
    if (this.isWorking) return;

    const type = target.dataset.shopType ?? "general";
    const preset = ShopService.getPresets().find(entry => entry.key === type);
    this.draftShop = ShopProfileModel.create({ name: preset?.label, type });
    this.selectedShopId = this.draftShop.id;
    this.inventoryLookupOpen = false;
    this.inventorySearchQuery = "";
    CompendiumService.clearCatalogCache();
    await this.render();
  }

  static async createPrefabShop(event, target) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) {
      ui.notifications.warn("Shop Manager requires a premium Marketplace entitlement.");
      return;
    }
    if (this.isWorking) return;

    const prefabId = target.dataset.prefabId;
    if (!prefabId) return;

    this.isWorking = true;
    this.workingMessage = "Creating prefab store…";
    await this.render();

    try {
      const shop = await ShopService.createPrefabShop(prefabId, { save: false });
      this.draftShop = shop;
      this.selectedShopId = shop.id;
      CompendiumService.clearCatalogCache();
    } catch (error) {
      console.error(`[${MODULE_ID}] Failed to create prefab shop`, error);
      ui.notifications.error(error?.message ?? "Morelord Marketplace could not create that prefab store.");
    } finally {
      this.isWorking = false;
      this.workingMessage = "";
      await this.render();
    }
  }

  static async selectShop(event, target) {
    event.preventDefault();
    if (this.isWorking) return;
    this.draftShop = null;
    this.selectedShopId = target.dataset.shopId;
    this.inventoryLookupOpen = false;
    this.inventorySearchQuery = "";
    await this.render();
  }

  static async saveShop(event) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) { ui.notifications.warn("Shop Manager requires a premium Marketplace entitlement."); return; }
    if (this.isWorking) return;
    const form = this._form();
    const shop = this.draftShop?.id === this.selectedShopId
      ? foundry.utils.deepClone(this.draftShop)
      : ShopService.getShop(this.selectedShopId);
    if (!form || !shop) return;
    const isDraft = shop.id === this.draftShop?.id;

    const data = new FormData(form);
    shop.name = String(data.get("name") ?? shop.name).trim() || shop.name;
    shop.img = String(data.get("img") ?? shop.img).trim() || shop.img;
    shop.reputation = String(data.get("reputation") ?? "neutral");
    shop.inventoryMode = String(data.get("inventoryMode") ?? "hybrid");
    shop.buyModifier = Number(data.get("buyModifier") ?? 1);
    shop.sellModifier = Number(data.get("sellModifier") ?? 0.5);
    shop.allowBuying = data.get("allowBuying") === "on";
    shop.allowSelling = data.get("allowSelling") === "on";
    shop.itemOptions = data.getAll("itemOptions").map(String);
    shop.itemTypes = getItemTypesForOptions(shop.itemOptions);
    shop.rarities = data.getAll("rarities").map(String);
    shop.randomInventory = {
      ...(shop.randomInventory ?? {}),
      enabled: data.get("randomEnabled") === "on",
      allowDuplicates: data.get("allowDuplicates") === "on",
      counts: {
        common: Number(data.get("stockCommon") ?? 0),
        uncommon: Number(data.get("stockUncommon") ?? 0),
        rare: Number(data.get("stockRare") ?? 0),
        veryrare: Number(data.get("stockVeryrare") ?? 0),
        legendary: Number(data.get("stockLegendary") ?? 0)
      }
    };
    shop.restock = {
      ...(shop.restock ?? {}),
      rule: String(data.get("restockRule") ?? "manual"),
      behavior: String(data.get("restockBehavior") ?? "replace")
    };

    const saved = await ShopService.saveShop(shop, { bumpRevision: !isDraft });
    this.draftShop = null;
    await ShopService.syncShopIdentity(saved);
    CompendiumService.clearCatalogCache();
    if (isDraft) {
      const catalog = await CompendiumService.getBuyableCatalog(saved);
      await ShopService.restock(saved.id, catalog);
      CompendiumService.clearCatalogCache();
    }
    ui.notifications.info(isDraft ? `${shop.name} created.` : `${shop.name} saved.`);
    await this.render();
  }

  static async deleteShop(event) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) { ui.notifications.warn("Shop Manager requires a premium Marketplace entitlement."); return; }
    if (this.isWorking) return;
    const shop = ShopService.getShop(this.selectedShopId);
    if (!shop) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete Shop" },
      content: `<p>Delete <strong>${foundry.utils.escapeHTML(shop.name)}</strong> and its shop actor/tokens?</p>`
    });
    if (!confirmed) return;
    await ShopService.deleteShop(shop.id);
    this.selectedShopId = ShopService.getShops()[0]?.id ?? null;
    CompendiumService.clearCatalogCache();
    await this.render();
  }

  static async placeShop(event) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) { ui.notifications.warn("Shop Manager requires a premium Marketplace entitlement."); return; }
    if (this.isWorking) return;
    const token = await ShopService.placeShopOnScene(this.selectedShopId);
    if (token) ui.notifications.info("Shop placed at the center of the current scene. Move the token where you want it.");
    await this.render();
  }

  static async restockShop(event) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) { ui.notifications.warn("Shop Manager requires a premium Marketplace entitlement."); return; }
    if (this.isWorking) return;
    // Restock the configuration currently visible in the editor. This avoids
    // rerolling the previously saved mode/counts when the GM adjusted them and
    // clicked Restock Now without clicking Save first.
    await MorelordShopManagerApp.saveShop.call(this, event);
    const shop = ShopService.getShop(this.selectedShopId);
    if (!shop) return;
    const catalog = await CompendiumService.getBuyableCatalog(shop);
    const restocked = await ShopService.restock(shop.id, catalog);
    ShopTransactionService.broadcastInventoryChanged(shop.id);
    if (restocked?.inventoryMode === "unlimited") {
      ui.notifications.warn(`${shop.name} uses an unlimited catalog, so restocking does not change its ${catalog.length} listings. Choose Limited or Hybrid inventory to rotate stock.`);
    } else {
      ui.notifications.info(`${shop.name} restocked.`);
    }
    await this.render();
  }

  static async browseImage(event, target) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) { ui.notifications.warn("Shop Manager requires a premium Marketplace entitlement."); return; }
    if (this.isWorking) return;

    const form = this._form();
    const input = form?.querySelector('input[name="img"]');
    if (!input) return;

    const FilePicker = foundry.applications.apps.FilePicker;
    const picker = new FilePicker({
      type: "image",
      current: input.value || "",
      callback: path => {
        input.value = path;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await picker.render(true);
  }

  static async exportShop(event) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) {
      ui.notifications.warn("Shop Manager requires a premium Marketplace entitlement.");
      return;
    }
    const shop = ShopService.getShop(this.selectedShopId);
    if (!shop) return;
    const payload = ShopService.getPortableDefinition(shop);
    const text = JSON.stringify(payload, null, 2);
    const slug = String(shop.name ?? "shop").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "shop";
    const filename = `morelord-marketplace-shop-${slug}.json`;
    const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
    if (typeof save === "function") {
      save(text, "application/json", filename);
      return;
    }
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  static async importShop(event) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) {
      ui.notifications.warn("Shop Manager requires a premium Marketplace entitlement.");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      this.isWorking = true;
      this.workingMessage = "Importing shop…";
      await this.render();
      try {
        const data = JSON.parse(await file.text());
        const shop = await ShopService.importPortableDefinition(data);
        this.selectedShopId = shop.id;
        CompendiumService.clearCatalogCache();
        ui.notifications.info(`${shop.name} imported.`);
      } catch (error) {
        console.error(`[${MODULE_ID}] Failed to import shop`, error);
        ui.notifications.error(error?.message ?? "Marketplace could not import that shop definition.");
      } finally {
        this.isWorking = false;
        this.workingMessage = "";
        await this.render();
      }
    }, { once: true });
    input.click();
  }

  static async openInventoryLookup(event) {
    event.preventDefault();
    this.inventoryLookupOpen = true;
    await this.render();
    this.element?.querySelector('[name="inventorySearch"]')?.focus();
  }

  static async closeInventoryLookup(event) {
    event.preventDefault();
    this.inventoryLookupOpen = false;
    this.inventorySearchQuery = "";
    await this.render();
  }

  static async addInventoryItem(event, target) {
    event.preventDefault();
    if (!game.user.isGM || !EntitlementService.hasShopManager()) return;
    const row = (await CompendiumService.getInventorySearchCatalog()).find(entry => entry.uuid === target.dataset.itemUuid);
    if (!row) return ui.notifications.warn("That item is no longer available in an enabled compendium.");
    await ShopService.addInventoryItem(this.selectedShopId, row, 1);
    CompendiumService.clearCatalogCache();
    ShopTransactionService.broadcastInventoryChanged(this.selectedShopId);
    this.inventoryLookupOpen = false;
    this.inventorySearchQuery = "";
    ui.notifications.info(`${row.name} added to the shop with quantity 1.`);
    await this.render();
  }

  static async adjustInventoryQuantity(event, target) {
    event.preventDefault();
    if (!game.user.isGM || !EntitlementService.hasShopManager()) return;
    const shop = ShopService.getShop(this.selectedShopId);
    const row = (await CompendiumService.getBuyableCatalog(shop)).find(entry => ShopService.stockKey(entry) === target.dataset.stockKey);
    if (!row) return;
    const quantity = ShopService.getStock(shop, row);
    if (!Number.isFinite(quantity)) return;
    const delta = Number(target.dataset.delta ?? 0);
    await ShopService.setStock(shop.id, row, Math.max(0, quantity + delta));
    CompendiumService.clearCatalogCache();
    ShopTransactionService.broadcastInventoryChanged(shop.id);
    await this.render();
  }

  static async removeInventoryItem(event, target) {
    event.preventDefault();
    if (!game.user.isGM || !EntitlementService.hasShopManager()) return;
    const shop = ShopService.getShop(this.selectedShopId);
    const row = (await CompendiumService.getBuyableCatalog(shop)).find(entry => ShopService.stockKey(entry) === target.dataset.stockKey);
    if (!row) return;
    await ShopService.removeInventoryItem(shop.id, row);
    CompendiumService.clearCatalogCache();
    ShopTransactionService.broadcastInventoryChanged(shop.id);
    ui.notifications.info(`${row.name} removed from the shop.`);
    await this.render();
  }

}
