import { MODULE_ID } from "../constants.js";
import { ActorService } from "../services/actor-service.js";
import { CurrencyService } from "../services/currency-service.js";
import { CompendiumService } from "../services/compendium-service.js";

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
      width: 1100,
      height: 700
    },
    actions: {
      switchTab: MorelordMarketplaceApp.switchTab,
      sellOne: MorelordMarketplaceApp.sellOne,
      sellAll: MorelordMarketplaceApp.sellAll,
      buyItem: MorelordMarketplaceApp.buyItem,
      clearSearch: MorelordMarketplaceApp.clearSearch,
      clearBuyFilters: MorelordMarketplaceApp.clearBuyFilters,
      cycleFacetFilter: MorelordMarketplaceApp.cycleFacetFilter,
      toggleAffordable: MorelordMarketplaceApp.toggleAffordable
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
    this.filters = this.getEmptyFilters();
    this.isLoadingBuy = false;
    MorelordMarketplaceApp.instances.add(this);
  }

  getEmptyFacet() {
    return { include: [], exclude: [] };
  }

  getEmptyFilters() {
    return {
      search: "",
      types: this.getEmptyFacet(),
      rarities: this.getEmptyFacet(),
      sources: this.getEmptyFacet(),
      subtypes: this.getEmptyFacet(),
      properties: this.getEmptyFacet(),
      attunement: "",
      affordableOnly: false,
      minPrice: "",
      maxPrice: ""
    };
  }

  async close(options = {}) {
    MorelordMarketplaceApp.instances.delete(this);
    return super.close(options);
  }

  static refreshForActor(actor) {
    for (const app of MorelordMarketplaceApp.instances) {
      if (app.actor?.id === actor?.id) app.render();
    }
  }

  async _prepareContext(options) {
    const actor = this.actor ?? ActorService.getMarketplaceActor();

    const selectedToken = game.canvas?.tokens?.controlled?.find(
      token => token.actor?.id === actor?.id
    );
    const sceneToken = selectedToken ?? game.canvas?.tokens?.placeables?.find(
      token => token.actor?.id === actor?.id
    );
    const tokenImg =
      sceneToken?.document?.texture?.src ??
      actor?.prototypeToken?.texture?.src ??
      actor?.img ??
      "icons/svg/mystery-man.svg";

    const context = {
      actor,
      tokenImg,
      isGM: game.user.isGM,
      activeTab: this.activeTab,
      isSellTab: this.activeTab === "sell",
      isBuyTab: this.activeTab === "buy",
      isSearchTab: this.activeTab === "search",
      isLoadingBuy: this.isLoadingBuy,
      filters: this.filters,
      canSell: game.settings.get(MODULE_ID, "enableSelling"),
      canBuy: game.settings.get(MODULE_ID, "enableBuying"),
      sellItems: [],
      buyItems: [],
      buyFacets: null,
      buyResultCount: 0,
      hasBuyFilters: this.hasActiveBuyFilters(),
      currency: null
    };

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

    if (context.isBuyTab && !this.isLoadingBuy) {
      const catalog = await CompendiumService.getBuyableCatalog();
      const availableCurrencyCp = CurrencyService.currencyToCp(
        CurrencyService.getCurrency(actor)
      );
      const runtimeFilters = {
        ...this.filters,
        availableCurrencyCp
      };

      context.buyItems = CompendiumService.filterRows(catalog, runtimeFilters);
      context.buyFacets = CompendiumService.buildFacets(catalog, this.filters);
      context.buyResultCount = context.buyItems.length;

      const includedTypes = new Set(this.filters.types.include);
      context.showSubtypeFilters = Boolean(
        includedTypes.size && context.buyFacets.subtypes.length
      );
      context.showPropertyFilters = Boolean(
        includedTypes.has("weapon") && context.buyFacets.properties.length
      );
      context.attunementAny = !this.filters.attunement;
      context.attunementRequired = this.filters.attunement === "required";
      context.attunementNotRequired = this.filters.attunement === "not-required";
    }

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (this.isLoadingBuy) return;

    const buyLayout = this.element.querySelector(".mlm-buy-layout");
    if (!buyLayout) return;

    const searchInput = buyLayout.querySelector("input[name='search']");
    searchInput?.addEventListener("keydown", async event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      this.filters.search = searchInput.value ?? "";
      await this.render();
    });

    for (const input of buyLayout.querySelectorAll("[data-filter-control]")) {
      input.addEventListener("change", async event => {
        event.preventDefault();
        event.stopPropagation();
        this.readSimpleBuyFilters(buyLayout);
        await this.render();
      });
    }
  }

  hasActiveBuyFilters() {
    const facetActive = facet =>
      facet.include.length > 0 || facet.exclude.length > 0;

    return Boolean(
      this.filters.search
      || facetActive(this.filters.types)
      || facetActive(this.filters.rarities)
      || facetActive(this.filters.sources)
      || facetActive(this.filters.subtypes)
      || facetActive(this.filters.properties)
      || this.filters.attunement
      || this.filters.affordableOnly
      || this.filters.minPrice !== ""
      || this.filters.maxPrice !== ""
    );
  }

  readSimpleBuyFilters(container) {
    this.filters = {
      ...this.filters,
      search: container.querySelector("[name='search']")?.value ?? "",
      attunement: container.querySelector("[name='attunement']:checked")?.value ?? "",
      minPrice: container.querySelector("[name='minPrice']")?.value ?? "",
      maxPrice: container.querySelector("[name='maxPrice']")?.value ?? ""
    };
  }

  cycleFacet(group, value) {
    const facet = this.filters[group];
    if (!facet || !value) return;

    const include = new Set(facet.include);
    const exclude = new Set(facet.exclude);

    if (!include.has(value) && !exclude.has(value)) {
      include.add(value);
    } else if (include.has(value)) {
      include.delete(value);
      exclude.add(value);
    } else {
      exclude.delete(value);
    }

    this.filters[group] = {
      include: [...include],
      exclude: [...exclude]
    };

    if (group === "types") {
      this.filters.subtypes = this.getEmptyFacet();
      this.filters.properties = this.getEmptyFacet();
    }
  }

  static async switchTab(event, target) {
    event.preventDefault();

    if (this.isLoadingBuy) return;

    const nextTab = target.dataset.tab;

    if (nextTab !== "buy") {
      this.activeTab = nextTab;
      await this.render();
      return;
    }

    this.activeTab = "buy";
    this.isLoadingBuy = true;

    // Render the loading state immediately before processing the catalog.
    await this.render();

    try {
      await CompendiumService.getBuyableCatalog();
    } catch (error) {
      console.error(`[${MODULE_ID}] Failed to load the Buy catalog`, error);
      ui.notifications.error(
        "Morelord Marketplace could not load the available items."
      );
    } finally {
      this.isLoadingBuy = false;
      await this.render();
    }
  }

  static async sellOne(event, target) {
    const itemId = target.dataset.itemId;
    await ActorService.sellItem(this.actor, itemId, 1);
    await this.render();
  }

  static async sellAll(event, target) {
    const itemId = target.dataset.itemId;
    const item = this.actor.items.get(itemId);
    const quantity = item?.system.quantity ?? 1;
    await ActorService.sellItem(this.actor, itemId, quantity);
    await this.render();
  }

  static async buyItem(event, target) {
    if (this.isLoadingBuy) return;

    await CompendiumService.buyCompendiumItem({
      actor: this.actor,
      packId: target.dataset.packId,
      documentId: target.dataset.documentId
    });

    await this.render();
  }

  static async cycleFacetFilter(event, target) {
    event.preventDefault();
    if (this.isLoadingBuy) return;

    const group = target.dataset.filterGroup;
    const value = target.dataset.filterValue;
    this.cycleFacet(group, value);
    await this.render();
  }

  static async toggleAffordable(event) {
    event.preventDefault();
    if (this.isLoadingBuy) return;

    this.filters.affordableOnly = !this.filters.affordableOnly;
    await this.render();
  }

  static async clearSearch(event) {
    event.preventDefault();
    if (this.isLoadingBuy) return;

    this.filters.search = "";
    await this.render();
  }

  static async clearBuyFilters(event) {
    event.preventDefault();
    if (this.isLoadingBuy) return;

    this.filters = this.getEmptyFilters();
    await this.render();
  }
}
