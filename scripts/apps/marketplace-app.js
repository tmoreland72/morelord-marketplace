import { MODULE_ID } from "../constants.js";
import { ActorService } from "../services/actor-service.js";
import { PricingService } from "../services/pricing-service.js";
import { CurrencyService } from "../services/currency-service.js";
import { CompendiumService } from "../services/compendium-service.js";
import { TransactionService } from "../services/transaction-service.js";
import { MorelordMarketplaceSettingsApp } from "./marketplace-settings-app.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MorelordMarketplaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "morelord-marketplace",
    classes: ["morelord-marketplace"],
    tag: "section",
    window: {
      title: "Morelord Marketplace",
      icon: "fa-solid fa-store",
      resizable: true
    },
    position: {
      width: 900,
      height: 650
    },
    actions: {
      switchTab: MorelordMarketplaceApp.switchTab,
      sellOne: MorelordMarketplaceApp.sellOne,
      sellAll: MorelordMarketplaceApp.sellAll,
      buyItem: MorelordMarketplaceApp.buyItem,
      applyFilters: MorelordMarketplaceApp.applyFilters,
      search: MorelordMarketplaceApp.search,
      clearSearch: MorelordMarketplaceApp.clearSearch,
      // openSettings: MorelordMarketplaceApp.openSettings,
      // refreshMarketplace: MorelordMarketplaceApp.refreshMarketplace
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/marketplace.hbs`
    }
  };

  static instances = new Set();

  constructor(options = {}) {
    super(options);
    this.actor = ActorService.getMarketplaceActor();
    this.activeTab = "sell";
    this.filters = {
      search: "",
      type: "",
      rarity: "",
      minPrice: "",
      maxPrice: ""
    };
    MorelordMarketplaceApp.instances.add(this);
  }

  async close(options = {}) {
    MorelordMarketplaceApp.instances.delete(this);
    return super.close(options);
  }

  static refreshForActor(actor) {
    for (const app of MorelordMarketplaceApp.instances) {
      if (actor?.id === game.user.character?.id) {
        app.render();
      }
    }
  }

  async _prepareContext(options) {
    const actor = this.actor ?? ActorService.getMarketplaceActor();

    const context = {
      actor,
      activeTab: this.activeTab,
      isSellTab: this.activeTab === "sell",
      isBuyTab: this.activeTab === "buy",
      isSearchTab: this.activeTab === "search",
      filters: this.filters,
      canSell: game.settings.get(MODULE_ID, "enableSelling"),
      canBuy: game.settings.get(MODULE_ID, "enableBuying"),
      sellItems: [],
      buyItems: [],
      currency: null,
      isGM: game.user.isGM,
    };

    context.typeOptions = [
      { value: "", label: "All Types", selected: this.filters.type === "" },
      { value: "weapon", label: "Weapons", selected: this.filters.type === "weapon" },
      { value: "equipment", label: "Equipment", selected: this.filters.type === "equipment" },
      { value: "consumable", label: "Consumables", selected: this.filters.type === "consumable" },
      { value: "tool", label: "Tools", selected: this.filters.type === "tool" },
      { value: "loot", label: "Loot", selected: this.filters.type === "loot" }
    ];

    context.rarityOptions = [
      { value: "", label: "All Rarities", selected: this.filters.rarity === "" },
      { value: "common", label: "Common", selected: this.filters.rarity === "common" },
      { value: "uncommon", label: "Uncommon", selected: this.filters.rarity === "uncommon" },
      { value: "rare", label: "Rare", selected: this.filters.rarity === "rare" },
      { value: "veryRare", label: "Very Rare", selected: this.filters.rarity === "veryRare" },
      { value: "legendary", label: "Legendary", selected: this.filters.rarity === "legendary" }
    ];

    if (!actor) {
      context.error = game.user.isGM
        ? "Select a character token before opening the marketplace."
        : "No assigned character found. Please assign a character to your user.";
      return context;
    }

    context.currency = CurrencyService.getCurrencyDisplay(actor);

    if (context.isSellTab) {
      context.sellItems = await ActorService.getSellableItems(actor);
    }

    if (context.isBuyTab) {
      context.buyItems = await CompendiumService.getBuyableItems(this.filters);
    }

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const searchInput = this.element.querySelector("input[name='search']");
    if (searchInput) {
      searchInput.addEventListener("keydown", async event => {
        if (event.key !== "Enter") return;

        event.preventDefault();
        event.stopPropagation();

        const filters = searchInput.closest(".mlm-filters");
        this.readFilters(filters);

        await this.render();
      });
    }

    for (const select of this.element.querySelectorAll(".mlm-filters select")) {
      select.addEventListener("change", async event => {
        event.preventDefault();
        event.stopPropagation();

        const filters = select.closest(".mlm-filters");
        this.readFilters(filters);

        await this.render();
      });
    }
  }

  static async switchTab(event, target) {
    this.activeTab = target.dataset.tab;
    await this.render();
  }

  static async sellOne(event, target) {
    const actor = this.actor;
    const itemId = target.dataset.itemId;
    await ActorService.sellItem(actor, itemId, 1);
    await this.render();
  }

  static async sellAll(event, target) {
    const actor = this.actor;
    const itemId = target.dataset.itemId;
    const item = actor.items.get(itemId);
    const quantity = item.system.quantity ?? 1;
    await ActorService.sellItem(actor, itemId, quantity);
    await this.render();
  }

  static async buyItem(event, target) {
    const actor = this.actor;

    await CompendiumService.buyCompendiumItem({
      actor,
      packId: target.dataset.packId,
      documentId: target.dataset.documentId
    });

    await this.render();
  }

  readFilters(container) {
    this.filters = {
      search: container.querySelector("[name='search']")?.value ?? "",
      type: container.querySelector("[name='type']")?.value ?? "",
      rarity: container.querySelector("[name='rarity']")?.value ?? "",
      minPrice: container.querySelector("[name='minPrice']")?.value ?? "",
      maxPrice: container.querySelector("[name='maxPrice']")?.value ?? ""
    };
  }

  static async search(event, target) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    event.stopPropagation();

    const form = target.closest(".mlm-filters");
    this.readFilters(form);

    await this.render();
  }

  static async clearSearch(event, target) {
    event.preventDefault();

    const form = target.closest(".mlm-filters");
    const input = form.querySelector("input[name='search']");

    if (input) input.value = "";

    this.filters.search = "";

    await this.render();
  }

  static async applyFilters(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const form = target.closest(".mlm-filters");
    this.readFilters(form);

    await this.render();
  }

  // static async openSettings(event, target) {
  //   event.preventDefault();
  //   if (!game.user.isGM) return;

  //   new MorelordMarketplaceSettingsApp().render(true);
  // }

  // static async refreshMarketplace(event, target) {
  //   event.preventDefault();
  //   await this.render();
  // }

}