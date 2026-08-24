import { MODULE_ID } from "../constants.js";
import { ActorService } from "../services/actor-service.js";
import { CurrencyService } from "../services/currency-service.js";
import { TransactionService } from "../services/transaction-service.js";
import { CompendiumService } from "../services/compendium-service.js";
import { ShopService } from "../services/shop-service.js";
import { MorelordShopManagerApp } from "./shop-manager-app.js";
import { ShopTransactionService } from "../services/shop-transaction-service.js";
import { EntitlementService } from "../services/entitlement-service.js";
import { WishlistService } from "../services/wishlist-service.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MorelordMarketplaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "morelord-marketplace",
    classes: ["ml-window", "ml-marketplace-module"],
    tag: "section",
    window: {
      title: "Morelord Marketplace",
      icon: "fa-solid fa-store",
      resizable: true
    },
    position: {
      width: 1280,
      height: 820
    },
    actions: {
      switchTab: MorelordMarketplaceApp.switchTab,
      sellOne: MorelordMarketplaceApp.sellOne,
      sellAll: MorelordMarketplaceApp.sellAll,
      buyItem: MorelordMarketplaceApp.buyItem,
      clearSearch: MorelordMarketplaceApp.clearSearch,
      clearBuyFilters: MorelordMarketplaceApp.clearBuyFilters,
      cycleFacetFilter: MorelordMarketplaceApp.cycleFacetFilter,
      toggleAffordable: MorelordMarketplaceApp.toggleAffordable,
      addToCart: MorelordMarketplaceApp.addToCart,
      removeFromCart: MorelordMarketplaceApp.removeFromCart,
      clearCart: MorelordMarketplaceApp.clearCart,
      checkoutCart: MorelordMarketplaceApp.checkoutCart,
      changeBuyPage: MorelordMarketplaceApp.changeBuyPage,
      addSellToCart: MorelordMarketplaceApp.addSellToCart,
      removeSellFromCart: MorelordMarketplaceApp.removeSellFromCart,
      clearSellCart: MorelordMarketplaceApp.clearSellCart,
      checkoutSellCart: MorelordMarketplaceApp.checkoutSellCart,
      manageShops: MorelordMarketplaceApp.manageShops,
      refreshShop: MorelordMarketplaceApp.refreshShop,
      addToWishlist: MorelordMarketplaceApp.addToWishlist,
      removeFromWishlist: MorelordMarketplaceApp.removeFromWishlist
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/marketplace.hbs`
    }
  };

  static instances = new Set();
  static shopOpening = false;

  static openShop(shopId) {
    if (this.shopOpening) {
      ui.notifications.info("A shop is already loading. Please wait.");
      return null;
    }

    const existing = [...this.instances].find(app => app.shopId === shopId);
    if (existing) {
      // A previous render failure can leave an application instance registered
      // even though its window is no longer visible. Re-rendering here makes the
      // actor-sheet fallback deterministic instead of silently doing nothing.
      void existing.render(true);
      existing.bringToFront?.();
      return existing;
    }

    this.shopOpening = true;
    const app = new this({ shopId });
    app.render(true);
    return app;
  }

  constructor(options = {}) {
    const applicationOptions = options.shopId
      ? {
          ...options,
          position: {
            width: 1480,
            height: 860,
            ...(options.position ?? {})
          }
        }
      : options;
    super(applicationOptions);
    this.actor = ActorService.getMarketplaceActor();
    this.actorId = this.actor?.id ?? null;
    this.fundingActorId = null;
    this.shopId = options.shopId ?? null;
    this.shopSnapshot = this.shopId ? foundry.utils.deepClone(ShopService.getShop(this.shopId)) : null;
    this.shopRevision = Number(this.shopSnapshot?.revision ?? 1);
    this.activeTab = this.shopId ? "buy" : "sell";
    this.sellSort = "name";
    this.filters = this.getEmptyFilters();
    this.panelScrollPositions = new Map();
    this.cart = new Map();
    this.sellCart = new Map();
    this.buyPage = 1;
    this.buyPageSize = 50;
    this.isLoadingBuy = Boolean(this.shopId);
    this._initialShopLoadStarted = false;
    this._reservationListener = event => {
      if (event?.detail?.shopId !== this.shopId) return;
      if (event?.detail?.inventoryChanged) void this.refreshShopSnapshot();
      else void this.render();
    };
    window.addEventListener("ml-marketplace-shop-reservations", this._reservationListener);
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
      weaponCategories: this.getEmptyFacet(),
      weaponRanges: this.getEmptyFacet(),
      properties: this.getEmptyFacet(),
      masteries: this.getEmptyFacet(),
      attunement: "",
      affordableOnly: false,
      minPrice: "",
      maxPrice: ""
    };
  }

  async close(options = {}) {
    MorelordMarketplaceApp.instances.delete(this);
    window.removeEventListener("ml-marketplace-shop-reservations", this._reservationListener);
    if (this.shopId) await ShopTransactionService.setReservation(this.shopId, {});
    if (this.shopId && this.isLoadingBuy) MorelordMarketplaceApp.shopOpening = false;
    return super.close(options);
  }

  async syncCartReservation() {
    if (!this.shopId) return;
    const quantities = {};
    for (const [key, entry] of this.cart.entries()) quantities[key] = Number(entry.quantity ?? 0);
    await ShopTransactionService.setReservation(this.shopId, quantities);
  }

  static refreshForActor(actor) {
    for (const app of MorelordMarketplaceApp.instances) {
      if (app.actor?.id === actor?.id || app.fundingActorId === actor?.id) app.render();
    }
  }

  async refreshShopSnapshot() {
    if (!this.shopId) return;
    const latest = ShopService.getShop(this.shopId);
    if (!latest) return void this.render();

    // Keep an active cart reviewable, but never leave an idle shop displaying
    // inventory from before a restock or settings change.
    if (!this.cart.size) {
      this.shopSnapshot = foundry.utils.deepClone(latest);
      this.shopRevision = Number(latest.revision ?? 1);
    }
    await this.render();
  }

  async _prepareContext(options) {
    // ApplicationV2 prepares the next context while the previous DOM is still
    // mounted, so capture exact positions even if the browser has not delivered
    // the latest passive scroll event yet.
    for (const panel of this.element?.querySelectorAll?.("[data-ml-marketplace-preserve-scroll]") ?? []) {
      this.panelScrollPositions.set(panel.dataset.mlMarketplacePreserveScroll, {
        top: panel.scrollTop,
        left: panel.scrollLeft
      });
    }

    const liveShop = this.shopId ? ShopService.getShop(this.shopId) : null;
    const shop = this.shopId ? (this.shopSnapshot ?? foundry.utils.deepClone(liveShop)) : null;
    const shopStale = Boolean(shop && liveShop && Number(liveShop.revision ?? 1) !== Number(this.shopRevision ?? 1));
    const shopperActors = ActorService.getShopperActors();
    const fundingActors = ActorService.getFundingActors();

    let actor = shopperActors.find(candidate => candidate.id === this.actorId) ?? null;
    if (!actor) {
      actor = ActorService.getDefaultActor(shopperActors);
      this.actorId = actor?.id ?? null;
    }
    this.actor = actor;

    let fundingActor = fundingActors.find(candidate => candidate.id === this.fundingActorId) ?? null;
    if (!fundingActor) fundingActor = ActorService.getDefaultActor(fundingActors);
    this.fundingActorId = fundingActor?.id ?? null;

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
      fundingActor,
      shop,
      shopperOptions: shopperActors.map(candidate => ({
        id: candidate.id,
        name: candidate.name,
        typeLabel: candidate.type === "group" ? "Group" : "Character",
        selected: candidate.id === actor?.id
      })),
      fundingOptions: fundingActors.map(candidate => ({
        id: candidate.id,
        name: candidate.name,
        typeLabel: candidate.type === "group" ? "Group" : "Actor",
        selected: candidate.id === fundingActor?.id
      })),
      showShopperSelector: shopperActors.length > 0,
      showFundingSelector: fundingActors.length > 0,
      isShop: Boolean(shop),
      shopName: shop?.name ?? null,
      shopImg: shop?.img ?? "icons/svg/house.svg",
      shopReputation: ShopService.getReputationTier(shop)?.label ?? null,
      tokenImg,
      isGM: game.user.isGM,
      canManageShops: Boolean(game.user.isGM && EntitlementService.hasShopManager()),
      shopStale,
      shopRevision: this.shopRevision,
      activeTab: this.activeTab,
      isSellTab: this.activeTab === "sell",
      isBuyTab: this.activeTab === "buy",
      isWishlistTab: this.activeTab === "wishlist",
      isSearchTab: this.activeTab === "search",
      isLoadingBuy: this.isLoadingBuy,
      filters: this.filters,
      canSell: shop ? (shop.allowSelling ?? true) : game.settings.get(MODULE_ID, "enableSelling"),
      canBuy: shop ? (shop.allowBuying ?? true) : game.settings.get(MODULE_ID, "enableBuying"),
      sellSortOptions: this.getSellSortOptions(),
      sellItems: [],
      buyItems: [],
      wishlistItems: [],
      wishlistCount: WishlistService.getEntries(actor).length,
      buyFacets: null,
      buyResultCount: 0,
      buyPage: 1,
      buyPageCount: 1,
      buyPageStart: 0,
      buyPageEnd: 0,
      hasPreviousBuyPage: false,
      hasNextBuyPage: false,
      previousBuyPage: 1,
      nextBuyPage: 1,
      hasBuyFilters: this.hasActiveBuyFilters(),
      currency: null,
      cartItems: [],
      cartTotal: "",
      cartTotalCp: 0,
      cartCount: 0,
      cartRemaining: "",
      cartRemainingCp: 0,
      canCheckout: false,
      isCheckingOut: Boolean(this.isCheckingOut)
    };

    if (!actor && !shop && context.isBuyTab) {
      context.error = game.user.isGM
        ? "No eligible character or group actor is available."
        : "You do not own an eligible character or group actor.";
      return context;
    }

    if (!actor && shop) {
      context.shopperNotice = game.user.isGM
        ? "Select a character token to buy or sell. You can browse this shop now."
        : "Select or assign your character to buy or sell. You can browse this shop now.";
    }

    if (fundingActor) context.currency = CurrencyService.getCurrencyDisplay(fundingActor);

    if (context.isSellTab) {
      const sellItems = actor ? await ActorService.getSellableItems(actor, { shop }) : [];
      context.sellItems = this.sortSellItems(sellItems).map(row => ({
        ...row,
        cartQty: this.sellCart.get(row.ownedItemId)?.quantity ?? 0,
        canAddToSellCart: context.canSell && (this.sellCart.get(row.ownedItemId)?.quantity ?? 0) < row.quantity
      }));
      context.sellCartItems = [...this.sellCart.values()].map(entry => ({
        ...entry.row,
        quantity: entry.quantity,
        lineTotalCp: entry.row.sellPriceCp * entry.quantity,
        lineTotal: CurrencyService.formatCp(entry.row.sellPriceCp * entry.quantity)
      }));
      context.sellCartCount = context.sellCartItems.reduce((sum, entry) => sum + entry.quantity, 0);
      context.sellCartTotalCp = context.sellCartItems.reduce((sum, entry) => sum + entry.lineTotalCp, 0);
      context.sellCartTotal = CurrencyService.formatCp(context.sellCartTotalCp);
      context.canCheckoutSell = !this.isCheckingOut && Boolean(actor) && context.sellCartCount > 0 && context.canSell && !shopStale;
    }

    if (context.isBuyTab && !this.isLoadingBuy) {
      const catalog = await CompendiumService.getBuyableCatalog(shop);
      const availableCurrencyCp = fundingActor
        ? CurrencyService.currencyToCp(CurrencyService.getCurrency(fundingActor))
        : 0;
      const runtimeFilters = {
        ...this.filters,
        availableCurrencyCp
      };

      const filteredBuyItems = CompendiumService.filterRows(catalog, runtimeFilters)
        .filter(row => !shop || ShopService.isInStock(shop, row));
      context.buyFacets = CompendiumService.buildFacets(catalog, this.filters);
      context.buyResultCount = filteredBuyItems.length;
      context.buyPageCount = Math.max(1, Math.ceil(filteredBuyItems.length / this.buyPageSize));
      this.buyPage = Math.min(Math.max(1, this.buyPage), context.buyPageCount);
      const pageStart = (this.buyPage - 1) * this.buyPageSize;
      const cartTotalBefore = [...this.cart.values()]
        .reduce((sum, entry) => sum + entry.row.buyPriceCp * entry.quantity, 0);
      const wishlistUuids = WishlistService.getUuids({ actor });

      context.buyItems = filteredBuyItems
        .slice(pageStart, pageStart + this.buyPageSize)
        .map(row => {
          const key = ShopService.stockKey(row);
          const cartQty = this.cart.get(key)?.quantity ?? 0;
          const stock = shop ? ShopService.getStock(shop, row) : Infinity;
          const canAffordNext = cartTotalBefore + row.buyPriceCp <= availableCurrencyCp;
          const reservedTotal = shop ? ShopTransactionService.getReserved(shop.id, key) : 0;
          const effectiveReserved = Math.max(reservedTotal, cartQty);
          const remainingStock = Number.isFinite(stock) ? Math.max(0, stock - effectiveReserved) : Infinity;
          const stockAllowsNext = !Number.isFinite(stock) || remainingStock > 0;
          return {
            ...row,
            isWishlisted: wishlistUuids.has(row.uuid),
            cartQty,
            reservedQty: effectiveReserved,
            stockLabel: Number.isFinite(remainingStock) ? `${remainingStock}${effectiveReserved > 0 ? "*" : ""}` : "∞",
            stockTitle: effectiveReserved > 0 ? `${effectiveReserved} unit(s) reserved in active shopping cart(s)` : "",
            canAddToCart: Boolean(actor && fundingActor) && canAffordNext && stockAllowsNext && context.canBuy
          };
        });
      context.buyPage = this.buyPage;
      context.buyPageStart = filteredBuyItems.length ? pageStart + 1 : 0;
      context.buyPageEnd = Math.min(pageStart + this.buyPageSize, filteredBuyItems.length);
      context.hasPreviousBuyPage = this.buyPage > 1;
      context.hasNextBuyPage = this.buyPage < context.buyPageCount;
      context.previousBuyPage = Math.max(1, this.buyPage - 1);
      context.nextBuyPage = Math.min(context.buyPageCount, this.buyPage + 1);

      context.cartItems = [...this.cart.values()].map(entry => ({
        ...entry.row,
        quantity: entry.quantity,
        lineTotalCp: entry.row.buyPriceCp * entry.quantity,
        lineTotal: CurrencyService.formatCp(entry.row.buyPriceCp * entry.quantity)
      }));
      context.cartTotalCp = context.cartItems.reduce((sum, entry) => sum + entry.lineTotalCp, 0);
      context.cartTotal = CurrencyService.formatCp(context.cartTotalCp);
      context.cartCount = context.cartItems.reduce((sum, entry) => sum + entry.quantity, 0);
      context.cartRemainingCp = Math.max(0, availableCurrencyCp - context.cartTotalCp);
      context.cartRemaining = CurrencyService.formatCp(context.cartRemainingCp);
      context.canCheckout = !this.isCheckingOut && !shopStale && Boolean(actor && fundingActor) && context.cartCount > 0 && context.cartTotalCp <= availableCurrencyCp;

      const includedTypes = new Set(this.filters.types.include);
      const excludedTypes = new Set(this.filters.types.exclude);
      const weaponsInScope = !excludedTypes.has("weapon")
        && (!includedTypes.size || includedTypes.has("weapon"));
      context.showSubtypeFilters = Boolean(
        includedTypes.size
        && (!includedTypes.has("weapon") || includedTypes.size > 1)
        && context.buyFacets.subtypes.length
      );
      context.showPropertyFilters = Boolean(
        weaponsInScope && context.buyFacets.properties.length
      );
      context.showWeaponFilters = Boolean(weaponsInScope);
      context.showMasteryFilters = Boolean(
        weaponsInScope && context.buyFacets.masteries.length
      );
      context.attunementAny = !this.filters.attunement;
      context.attunementRequired = this.filters.attunement === "required";
      context.attunementNotRequired = this.filters.attunement === "not-required";
    }

    if (context.isWishlistTab && !shop && !this.isLoadingBuy) {
      const catalog = await CompendiumService.getBuyableCatalog();
      const catalogByUuid = new Map(catalog.map(row => [row.uuid, row]));
      const availableCurrencyCp = fundingActor
        ? CurrencyService.currencyToCp(CurrencyService.getCurrency(fundingActor))
        : 0;
      context.wishlistItems = WishlistService.getEntries(actor).map(saved => {
        const row = catalogByUuid.get(saved.uuid);
        const item = { ...saved, ...(row ?? {}) };
        return {
          ...item,
          isAvailable: Boolean(row && context.canBuy),
          canBuyNow: Boolean(row && context.canBuy && actor && fundingActor && row.buyPriceCp <= availableCurrencyCp),
          availabilityLabel: !row ? "Unavailable" : (!context.canBuy ? "Buying disabled" : (row.buyPriceCp <= availableCurrencyCp ? "Available" : "Need more coin"))
        };
      });
      context.wishlistCount = context.wishlistItems.length;
    }

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    for (const panel of this.element.querySelectorAll("[data-ml-marketplace-preserve-scroll]")) {
      const key = panel.dataset.mlMarketplacePreserveScroll;
      const position = this.panelScrollPositions.get(key);
      panel.scrollTop = typeof position === "number" ? position : position?.top ?? 0;
      panel.scrollLeft = typeof position === "object" ? position?.left ?? 0 : 0;
      panel.addEventListener("scroll", () => {
        this.panelScrollPositions.set(key, {
          top: panel.scrollTop,
          left: panel.scrollLeft
        });
      }, { passive: true });
    }

    if (this.shopId && this.isLoadingBuy && !this._initialShopLoadStarted) {
      this._initialShopLoadStarted = true;
      queueMicrotask(async () => {
        try {
          await CompendiumService.getBuyableCatalog(this.shopSnapshot ?? ShopService.getShop(this.shopId));
        } catch (error) {
          console.error(`[${MODULE_ID}] Failed to load shop catalog`, error);
          ui.notifications.error("Morelord Marketplace could not load this shop's inventory.");
        } finally {
          this.isLoadingBuy = false;
          MorelordMarketplaceApp.shopOpening = false;
          await this.render();
        }
      });
    }

    const shopperSelect = this.element.querySelector("[data-ml-marketplace-shopper-select]");
    shopperSelect?.addEventListener("change", async event => {
      const nextId = event.currentTarget.value || null;
      if (nextId === this.actorId) return;
      this.actorId = nextId;
      this.actor = nextId ? game.actors.get(nextId) ?? null : null;
      if (!this.fundingActorId || !ActorService.getFundingActors().some(candidate => candidate.id === this.fundingActorId)) {
        this.fundingActorId = ActorService.hasCurrency(this.actor) ? this.actor?.id ?? null : null;
      }
      this.cart.clear();
      this.sellCart.clear();
      await this.syncCartReservation();
      await this.render();
    });

    const fundingSelect = this.element.querySelector("[data-ml-marketplace-funding-select]");
    fundingSelect?.addEventListener("change", async event => {
      this.fundingActorId = event.currentTarget.value || null;
      await this.render();
    });

    const sellSortSelect = this.element.querySelector("[data-ml-marketplace-sell-sort]");
    sellSortSelect?.addEventListener("change", async event => {
      this.sellSort = event.currentTarget.value || "name";
      await this.render();
    });

    if (this.isLoadingBuy) return;

    const buyLayout = this.element.querySelector(".ml-marketplace-buy-layout");
    if (!buyLayout) return;

    const searchInput = buyLayout.querySelector("input[name='search']");
    searchInput?.addEventListener("keydown", async event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      this.filters.search = searchInput.value ?? "";
      this.buyPage = 1;
      await this.render();
    });

    for (const input of buyLayout.querySelectorAll("[data-filter-control]")) {
      input.addEventListener("change", async event => {
        event.preventDefault();
        event.stopPropagation();
        this.readSimpleBuyFilters(buyLayout);
        this.buyPage = 1;
        await this.render();
      });
    }
  }

  getFundingActor() {
    return ActorService.getFundingActors().find(actor => actor.id === this.fundingActorId) ?? null;
  }

  getSellSortOptions() {
    return [
      { value: "name", label: "Name" },
      { value: "type", label: "Type" },
      { value: "quantity", label: "Quantity" },
      { value: "listPriceCp", label: "List Price" },
      { value: "sellPriceCp", label: "Sell Price" }
    ].map(option => ({
      ...option,
      selected: option.value === this.sellSort
    }));
  }

  sortSellItems(items) {
    const numericFields = new Set(["quantity", "listPriceCp", "sellPriceCp"]);
    const field = this.getSellSortOptions().some(option => option.value === this.sellSort)
      ? this.sellSort
      : "name";

    return [...items].sort((left, right) => {
      const comparison = numericFields.has(field)
        ? Number(left[field] ?? 0) - Number(right[field] ?? 0)
        : String(left[field] ?? "").localeCompare(String(right[field] ?? ""), undefined, {
            numeric: true,
            sensitivity: "base"
          });

      return comparison || String(left.name ?? "").localeCompare(String(right.name ?? ""), undefined, {
        numeric: true,
        sensitivity: "base"
      });
    });
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
      || facetActive(this.filters.weaponCategories)
      || facetActive(this.filters.weaponRanges)
      || facetActive(this.filters.properties)
      || facetActive(this.filters.masteries)
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
      this.filters.weaponCategories = this.getEmptyFacet();
      this.filters.weaponRanges = this.getEmptyFacet();
      this.filters.properties = this.getEmptyFacet();
      this.filters.masteries = this.getEmptyFacet();
    }
    this.buyPage = 1;
  }

  static async switchTab(event, target) {
    event.preventDefault();

    if (this.isLoadingBuy) return;

    const nextTab = target.dataset.tab;

    if (nextTab !== "buy" && nextTab !== "wishlist") {
      this.activeTab = nextTab;
      await this.render();
      return;
    }

    this.activeTab = nextTab;
    this.isLoadingBuy = true;

    // Render the loading state immediately before processing the catalog.
    await this.render();

    try {
      await CompendiumService.getBuyableCatalog(this.shopId ? (this.shopSnapshot ?? ShopService.getShop(this.shopId)) : null);
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
    return MorelordMarketplaceApp.addSellToCart.call(this, event, target);
  }

  static async sellAll(event, target) {
    const itemId = target.dataset.itemId;
    const item = this.actor?.items.get(itemId);
    const quantity = item?.system.quantity ?? 1;
    await MorelordMarketplaceApp.addSellToCart.call(this, event, target, Number(quantity));
  }

  static async addSellToCart(event, target, requestedQuantity = 1) {
    event?.preventDefault?.();
    if (!this.actor) return;
    const itemId = target.dataset.itemId;
    const rows = await ActorService.getSellableItems(this.actor, { shop: this.shopId ? this.shopSnapshot : null });
    const row = rows.find(entry => entry.ownedItemId === itemId);
    if (!row) return;
    const current = this.sellCart.get(itemId) ?? { row, quantity: 0 };
    const quantity = Math.min(row.quantity, current.quantity + Number(requestedQuantity || 1));
    this.sellCart.set(itemId, { row, quantity });
    await this.render();
  }

  static async removeSellFromCart(event, target) {
    event.preventDefault();
    const itemId = target.dataset.itemId;
    const current = this.sellCart.get(itemId);
    if (!current) return;
    if (current.quantity <= 1) this.sellCart.delete(itemId);
    else this.sellCart.set(itemId, { ...current, quantity: current.quantity - 1 });
    await this.render();
  }

  static async clearSellCart(event) {
    event.preventDefault();
    this.sellCart.clear();
    await this.render();
  }

  static async checkoutSellCart(event) {
    event.preventDefault();
    if (this.isCheckingOut || !this.actor || !this.sellCart.size) return;
    this.isCheckingOut = true;
    await this.render();
    try {
      const result = await ActorService.sellCart(this.actor, [...this.sellCart.values()].map(entry => ({
        itemId: entry.row.ownedItemId,
        quantity: entry.quantity
      })), { shop: this.shopId ? this.shopSnapshot : null });
      if (result?.status === "completed" || result?.status === "pending") this.sellCart.clear();
    } catch (error) {
      console.error(`[${MODULE_ID}] Sell cart checkout failed`, error);
      ui.notifications.error(error?.message ?? "The sell cart could not be completed. No changes were kept.");
    } finally {
      this.isCheckingOut = false;
    }
    await this.render();
  }

  static async buyItem(event, target) {
    if (this.isLoadingBuy) return;
    return MorelordMarketplaceApp.addToCart.call(this, event, target);
  }

  static async addToWishlist(event, target) {
    event?.preventDefault?.();
    if (!this.actor) {
      ui.notifications.warn("Select who is shopping before adding an item to a wishlist.");
      return;
    }
    const catalog = await CompendiumService.getBuyableCatalog(this.shopId ? (this.shopSnapshot ?? ShopService.getShop(this.shopId)) : null);
    const row = catalog.find(entry => entry.packId === target.dataset.packId && entry.documentId === target.dataset.documentId);
    if (!row) return;
    const added = await WishlistService.add(row, this.actor);
    ui.notifications.info(added ? `${row.name} added to ${this.actor.name}'s wishlist.` : `${row.name} is already on ${this.actor.name}'s wishlist.`);
    await this.render();
  }

  static async removeFromWishlist(event, target) {
    event?.preventDefault?.();
    await WishlistService.remove(target.dataset.uuid, this.actor);
    await this.render();
  }

  static async addToCart(event, target) {
    event?.preventDefault?.();
    const shop = this.shopId ? (this.shopSnapshot ?? ShopService.getShop(this.shopId)) : null;
    const catalog = await CompendiumService.getBuyableCatalog(shop);
    const row = catalog.find(entry => entry.packId === target.dataset.packId && entry.documentId === target.dataset.documentId);
    if (!row || (shop && !ShopService.isInStock(shop, row))) return;

    const key = ShopService.stockKey(row);
    const current = this.cart.get(key) ?? { row, quantity: 0 };
    const stock = shop ? ShopService.getStock(shop, row) : Infinity;
    const sharedReserved = shop ? ShopTransactionService.getReserved(shop.id, key) : 0;
    const effectiveReserved = Math.max(sharedReserved, current.quantity);
    if (Number.isFinite(stock) && effectiveReserved >= stock) {
      ui.notifications.warn("That shop does not have any more unreserved stock of this item.");
      return;
    }

    const fundingActor = this.getFundingActor();
    if (!this.actor || !fundingActor) {
      ui.notifications.warn("Select both a shopper and a source of purchase funds first.");
      return;
    }
    const availableCp = CurrencyService.currencyToCp(CurrencyService.getCurrency(fundingActor));
    const cartCp = [...this.cart.values()].reduce((sum, entry) => sum + entry.row.buyPriceCp * entry.quantity, 0);
    if (cartCp + row.buyPriceCp > availableCp) {
      ui.notifications.warn("You cannot afford to add that item to your cart.");
      return;
    }

    this.cart.set(key, { row, quantity: current.quantity + 1 });
    await this.syncCartReservation();
    await this.render();
  }

  static async removeFromCart(event, target) {
    event.preventDefault();
    const key = target.dataset.cartKey;
    const current = this.cart.get(key);
    if (!current) return;
    if (current.quantity <= 1) this.cart.delete(key);
    else this.cart.set(key, { ...current, quantity: current.quantity - 1 });
    await this.syncCartReservation();
    await this.render();
  }

  static async clearCart(event) {
    event.preventDefault();
    this.cart.clear();
    await this.syncCartReservation();
    await this.render();
  }

  static async checkoutCart(event) {
    event.preventDefault();
    if (this.isCheckingOut) return;

    const shop = this.shopId ? (this.shopSnapshot ?? ShopService.getShop(this.shopId)) : null;
    const fundingActor = this.getFundingActor();
    if (!this.actor || !fundingActor || !this.cart.size) return;

    const requestItems = [...this.cart.values()].map(entry => ({
      packId: entry.row.packId,
      documentId: entry.row.documentId,
      quantity: entry.quantity,
      priceCp: entry.row.buyPriceCp
    }));

    this.isCheckingOut = true;
    await this.render();

    let result;
    try {
      result = shop
        ? await ShopTransactionService.checkout({
          shopId: shop.id,
          actorId: this.actor.id,
          fundingActorId: fundingActor.id,
          items: requestItems,
          expectedRevision: this.shopRevision
        })
        : await CompendiumService.buyCart({ actor: this.actor, fundingActor, items: requestItems });
    } catch (error) {
      console.error(`[${MODULE_ID}] Buy cart checkout failed`, error);
      result = { ok: false, error: error?.message ?? "The cart purchase failed." };
    } finally {
      this.isCheckingOut = false;
    }

    if (!result?.ok) {
      ui.notifications.error(result?.error ?? "The cart purchase failed. No changes were kept.");
      await this.render();
      return;
    }

    this.cart.clear();
    await this.syncCartReservation();
    if (this.shopSnapshot) {
      this.shopSnapshot.stock = foundry.utils.deepClone(result.stock ?? this.shopSnapshot.stock ?? {});
      this.shopSnapshot.revision = Number(result.shopRevision ?? this.shopRevision ?? 1);
      this.shopRevision = Number(this.shopSnapshot.revision ?? 1);
    }
    await TransactionService.postCartPurchase({
      actor: this.actor,
      fundingActor,
      shop,
      items: result.items ?? []
    });
    ui.notifications.info(`Purchased ${(result.items ?? []).reduce((sum, line) => sum + Number(line.quantity ?? 0), 0)} item(s) from ${shop.name}.`);
    await this.render();
  }

  static async changeBuyPage(event, target) {
    event.preventDefault();
    const page = Number(target.dataset.page);
    if (!Number.isInteger(page) || page < 1) return;
    this.buyPage = page;
    await this.render();
  }

  static async manageShops(event) {
    event.preventDefault();
    if (!EntitlementService.hasShopManager()) {
      ui.notifications.warn("Shop Manager requires the Marketplace Shop Manager premium feature.");
      return;
    }
    new MorelordShopManagerApp({ shopId: this.shopId }).render(true);
  }

  static async refreshShop(event) {
    event?.preventDefault?.();
    if (!this.shopId || this.isLoadingBuy || this.isCheckingOut) return;
    const latest = ShopService.getShop(this.shopId);
    if (!latest) {
      ui.notifications.error("This shop no longer exists.");
      return;
    }
    this.cart.clear();
    await this.syncCartReservation();
    this.shopSnapshot = foundry.utils.deepClone(latest);
    this.shopRevision = Number(latest.revision ?? 1);
    this.isLoadingBuy = true;
    await this.render();
    try {
      CompendiumService.clearCatalogCache();
      await CompendiumService.getBuyableCatalog(this.shopSnapshot);
    } finally {
      this.isLoadingBuy = false;
      await this.render();
    }
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
    this.buyPage = 1;
    await this.render();
  }

  static async clearSearch(event) {
    event.preventDefault();
    if (this.isLoadingBuy) return;

    this.filters.search = "";
    this.buyPage = 1;
    await this.render();
  }

  static async clearBuyFilters(event) {
    event.preventDefault();
    if (this.isLoadingBuy) return;

    this.filters = this.getEmptyFilters();
    this.buyPage = 1;
    await this.render();
  }
}
