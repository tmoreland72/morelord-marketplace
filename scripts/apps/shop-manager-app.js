import { MODULE_ID } from "../constants.js";
import { ShopService } from "../services/shop-service.js";
import { CompendiumService } from "../services/compendium-service.js";
import { EntitlementService } from "../services/entitlement-service.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MorelordShopManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "morelord-marketplace-shops",
    classes: ["morelord-marketplace", "mlm-shop-manager"],
    tag: "section",
    window: { title: "Marketplace Shops", icon: "fa-solid fa-store", resizable: true },
    position: { width: 980, height: 720 },
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
      importShop: MorelordShopManagerApp.importShop
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
  }

  async _prepareContext() {
    const shops = ShopService.getShops();
    const selected = ShopService.getShop(this.selectedShopId) ?? shops[0] ?? null;
    if (selected && !this.selectedShopId) this.selectedShopId = selected.id;

    let prefabs = [];
    try {
      prefabs = await ShopService.getPrefabStores();
    } catch (error) {
      console.warn(`[${MODULE_ID}] Unable to load prefab shops`, error);
    }

    const itemTypeOptions = ["weapon", "equipment", "consumable", "tool", "loot", "container"];
    const rarityOptions = ["common", "uncommon", "rare", "veryrare", "legendary", "artifact"];
    const checked = (values, key) => values?.includes(key);

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
        itemTypeOptions: itemTypeOptions.map(key => ({ key, checked: checked(selected.itemTypes, key), label: key.charAt(0).toUpperCase() + key.slice(1) })),
        rarityOptions: rarityOptions.map(key => ({ key, checked: checked((selected.rarities ?? []).map(ShopService.normalizeRarity), key), label: key === "veryrare" ? "Very Rare" : key.charAt(0).toUpperCase() + key.slice(1) })),
        reputations: ShopService.getReputationTiers().map(tier => ({ ...tier, selected: tier.key === selected.reputation })),
        inventoryModes: [
          { key: "unlimited", label: "Unlimited Catalog" },
          { key: "limited", label: "Limited Stock" },
          { key: "hybrid", label: "Hybrid" }
        ].map(mode => ({ ...mode, selected: mode.key === selected.inventoryMode })),
        restockRules: [
          { key: "manual", label: "GM Restock" },
          { key: "daily", label: "Daily" },
          { key: "three-days", label: "Every 3 Days" },
          { key: "weekly", label: "Weekly" },
          { key: "long-rest", label: "After Long Rest" },
          { key: "never", label: "Never" }
        ].map(rule => ({ ...rule, selected: rule.key === selected.restock?.rule })),
        restockBehaviors: [
          { key: "replace", label: "Reroll / replace inventory" },
          { key: "topup", label: "Top up inventory" }
        ].map(behavior => ({ ...behavior, selected: behavior.key === selected.restock?.behavior }))
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
      workingMessage: this.workingMessage || "Working…"
    };
  }

  _form() {
    return this.element?.querySelector("form[data-shop-form]");
  }

  static async createShop(event, target) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) { ui.notifications.warn("Shop Manager requires a premium Marketplace entitlement."); return; }
    if (this.isWorking) return;

    const type = target.dataset.shopType ?? "general";
    const preset = ShopService.getPresets().find(entry => entry.key === type);
    this.isWorking = true;
    this.workingMessage = `Creating ${preset?.label ?? "shop"}…`;
    await this.render();

    try {
      const shop = await ShopService.createShop({ name: preset?.label, type });
      this.selectedShopId = shop.id;
      CompendiumService.clearCatalogCache();
      const catalog = await CompendiumService.getBuyableCatalog(shop);
      await ShopService.restock(shop.id, catalog);
    } catch (error) {
      console.error(`[${MODULE_ID}] Failed to create shop`, error);
      ui.notifications.error("Morelord Marketplace could not create that shop.");
    } finally {
      this.isWorking = false;
      this.workingMessage = "";
      await this.render();
    }
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
      const shop = await ShopService.createPrefabShop(prefabId);
      this.selectedShopId = shop.id;
      CompendiumService.clearCatalogCache();
      ui.notifications.info(`${shop.name} created from prefab inventory.`);
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
    this.selectedShopId = target.dataset.shopId;
    await this.render();
  }

  static async saveShop(event) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) { ui.notifications.warn("Shop Manager requires a premium Marketplace entitlement."); return; }
    if (this.isWorking) return;
    const form = this._form();
    const shop = ShopService.getShop(this.selectedShopId);
    if (!form || !shop) return;

    const data = new FormData(form);
    shop.name = String(data.get("name") ?? shop.name).trim() || shop.name;
    shop.img = String(data.get("img") ?? shop.img).trim() || shop.img;
    shop.reputation = String(data.get("reputation") ?? "neutral");
    shop.inventoryMode = String(data.get("inventoryMode") ?? "hybrid");
    shop.buyModifier = Number(data.get("buyModifier") ?? 1);
    shop.sellModifier = Number(data.get("sellModifier") ?? 0.5);
    shop.allowBuying = data.get("allowBuying") === "on";
    shop.allowSelling = data.get("allowSelling") === "on";
    shop.itemTypes = data.getAll("itemTypes").map(String);
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

    const saved = await ShopService.saveShop(shop, { bumpRevision: true });
    await ShopService.syncShopIdentity(saved);
    CompendiumService.clearCatalogCache();
    ui.notifications.info(`${shop.name} saved.`);
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
    const shop = ShopService.getShop(this.selectedShopId);
    if (!shop) return;
    const catalog = await CompendiumService.getBuyableCatalog(shop);
    await ShopService.restock(shop.id, catalog);
    ui.notifications.info(`${shop.name} restocked.`);
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

}
