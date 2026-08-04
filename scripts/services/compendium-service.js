import { MODULE_ID } from "../constants.js";
import { PricingService } from "./pricing-service.js";
import { CurrencyService } from "./currency-service.js";
import { ShopService } from "./shop-service.js";
import { TransactionService } from "./transaction-service.js";
import { TransactionApprovalService } from "./transaction-approval-service.js";

export class CompendiumService {
  static indexCache = new Map();
  static catalogCache = new Map();

  static RARITY_DEFINITIONS = [
    { value: "common", label: "Common", order: 0 },
    { value: "uncommon", label: "Uncommon", order: 1 },
    { value: "rare", label: "Rare", order: 2 },
    { value: "veryrare", label: "Very Rare", order: 3 },
    { value: "legendary", label: "Legendary", order: 4 },
    { value: "artifact", label: "Artifact", order: 5 }
  ];

  static getAllowedPackIds() {
    return game.settings.get(
      MODULE_ID,
      "allowedCompendiums"
    ) ?? [];
  }

  static getAllowedPacks() {
    return this.getAllowedPackIds()
      .map(packId => game.packs.get(packId))
      .filter(Boolean);
  }

  static clearCache() {
    this.indexCache.clear();
    this.catalogCache.clear();
  }

  static async getBuyableCatalog() {
    const packs = this.getAllowedPacks();
    const currentShop = ShopService.getCurrentShop();

    const cacheKey = JSON.stringify({
      packs: packs
        .map(pack => pack.collection)
        .sort(),
      shopId: currentShop?.id ?? null,
      priceModifier: currentShop?.priceModifier ?? 1
    });

    if (this.catalogCache.has(cacheKey)) {
      return this.catalogCache.get(cacheKey);
    }

    const rows = [];

    for (const pack of packs) {
      const index = await this.getPackIndex(pack);

      for (const entry of index) {
        const row = await this.indexEntryToMarketplaceRow(
          pack,
          entry,
          currentShop
        );

        if (row) rows.push(row);
      }
    }

    const catalog = this.dedupeRows(rows)
      .sort((a, b) => a.name.localeCompare(b.name));

    this.catalogCache.set(cacheKey, catalog);

    return catalog;
  }

  static async getBuyableItems(filters = {}) {
    const catalog = await this.getBuyableCatalog();
    return this.filterRows(catalog, filters);
  }

  static filterRows(rows, filters = {}) {
    return rows.filter(row =>
      this.passesFilters(row, filters)
    );
  }

  static buildFacets(rows, filters = {}) {
    const search = this.normalize(filters.search);
    const includedTypes = new Set(filters.types?.include ?? []);
    const excludedTypes = new Set(filters.types?.exclude ?? []);

    const baseRows = rows.filter(row => {
      if (search && !this.normalize(row.name).includes(search)) return false;
      if (excludedTypes.has(row.typeKey)) return false;
      if (includedTypes.size && !includedTypes.has(row.typeKey)) return false;
      return true;
    });

    return {
      types: this.buildFacetOptions(
        rows,
        "typeKey",
        "typeLabel",
        filters.types
      ),
      rarities: this.buildRarityFacetOptions(
        baseRows,
        filters.rarities
      ),
      sources: this.buildFacetOptions(
        baseRows,
        "sourceKey",
        "source",
        filters.sources
      ),
      subtypes: this.buildFacetOptions(
        baseRows,
        "subtypeKey",
        "subtypeLabel",
        filters.subtypes
      ),
      properties: this.buildArrayFacetOptions(
        baseRows,
        "properties",
        filters.properties
      )
    };
  }

  static getFacetState(value, filter = {}) {
    const normalized = this.normalize(value);
    const includes = new Set((filter.include ?? []).map(v => this.normalize(v)));
    const excludes = new Set((filter.exclude ?? []).map(v => this.normalize(v)));

    if (includes.has(normalized)) return "include";
    if (excludes.has(normalized)) return "exclude";
    return "none";
  }

  static decorateFacetOption(option, filter = {}) {
    const state = this.getFacetState(option.value, filter);
    return {
      ...option,
      state,
      isIncluded: state === "include",
      isExcluded: state === "exclude",
      isNeutral: state === "none",
      stateTitle: state === "include"
        ? `Include ${option.label}`
        : state === "exclude"
          ? `Exclude ${option.label}`
          : `No filter for ${option.label}`
    };
  }

  static buildFacetOptions(
    rows,
    valueProperty,
    labelProperty,
    filter = {}
  ) {
    const options = new Map();

    for (const row of rows) {
      const value = this.normalize(row[valueProperty]);
      if (!value) continue;

      const label = row[labelProperty] || this.titleCase(value);
      const current = options.get(value) ?? { value, label, count: 0 };
      current.count += 1;
      options.set(value, current);
    }

    return Array.from(options.values())
      .map(option => this.decorateFacetOption(option, filter))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  static buildRarityFacetOptions(rows, filter = {}) {
    const counts = new Map();

    for (const row of rows) {
      const rarity = this.normalizeRarity(row.rarityKey);
      counts.set(rarity, (counts.get(rarity) ?? 0) + 1);
    }

    return this.RARITY_DEFINITIONS
      .map(definition => this.decorateFacetOption({
        value: definition.value,
        label: definition.label,
        count: counts.get(definition.value) ?? 0,
        order: definition.order
      }, filter))
      .filter(option => option.count > 0 || !option.isNeutral)
      .sort((a, b) => a.order - b.order);
  }

  static buildArrayFacetOptions(rows, property, filter = {}) {
    const options = new Map();

    for (const row of rows) {
      for (const propertyEntry of row[property] ?? []) {
        const value = this.normalize(propertyEntry.value);
        if (!value) continue;

        const current = options.get(value) ?? {
          value,
          label: propertyEntry.label || this.titleCase(value),
          count: 0
        };
        current.count += 1;
        options.set(value, current);
      }
    }

    return Array.from(options.values())
      .map(option => this.decorateFacetOption(option, filter))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  static async getPackIndex(pack) {
    if (this.indexCache.has(pack.collection)) {
      return this.indexCache.get(pack.collection);
    }

    /*
     * Do not request paths such as system.source.book here.
     *
     * Some compendium items store system.source as a primitive value,
     * including a number. Asking Foundry to index both system.source
     * and system.source.book causes:
     *
     * "Cannot create property 'book' on number '1'"
     */
    const index = await pack.getIndex({
      fields: [
        "name",
        "type",
        "img",
        "system.price",
        "system.rarity",
        "system.type",
        "system.armor",
        "system.properties",
        "system.attunement",
        "system.identifier",
        "system.source"
      ]
    });

    this.indexCache.set(pack.collection, index);

    return index;
  }

  static async indexEntryToMarketplaceRow(
    pack,
    entry,
    shop
  ) {
    if (
      shop &&
      !ShopService.entryPassesShop(
        entry,
        shop,
        pack.collection
      )
    ) {
      return null;
    }

    let itemData = entry;

    let priceCp = PricingService.getItemPriceCp({
      system: entry.system ?? {}
    });

    const missingFilterData =
      entry.system?.type === undefined ||
      entry.system?.properties === undefined;

    /*
     * Compendium indexes do not always preserve the complete dnd5e source
     * structure. An item may show a source book on its sheet while the index
     * exposes only a primitive value or an incomplete object. Load the full
     * document whenever the indexed source cannot identify a book.
     */
    const missingSourceData =
      !this.hasUsableSource(entry.system?.source);

    if (!priceCp || missingFilterData || missingSourceData) {
      const document = await pack.getDocument(
        entry._id
      );

      if (!document) return null;

      itemData = document;
      priceCp = PricingService.getItemPriceCp(
        document
      );
    }

    if (!priceCp) return null;

    priceCp = PricingService.applyShopModifier(
      priceCp,
      shop
    );

    const system =
      itemData.system ??
      entry.system ??
      {};

    const typeKey = this.normalize(
      itemData.type ?? entry.type
    );

    const rarityKey = this.normalizeRarity(
      system.rarity
    );

    const subtypeKey = this.getSubtypeKey(
      typeKey,
      system
    );

    const source = this.getSourceBook(
      system.source,
      pack
    );

    const sourceKey =
      this.normalizeSourceKey(source);

    return {
      documentId: entry._id,
      packId: pack.collection,
      uuid:
        `Compendium.${pack.collection}.Item.${entry._id}`,

      name: entry.name,
      img: entry.img,

      typeKey,
      typeLabel: this.getItemTypeLabel(typeKey),

      subtypeKey,
      subtypeLabel: this.getSubtypeLabel(
        typeKey,
        subtypeKey
      ),

      rarityKey,
      rarityLabel:
        this.getRarityLabel(rarityKey),

      sourceKey,
      source,

      buyPriceCp: priceCp,
      buyPrice:
        CurrencyService.formatCp(priceCp),

      properties:
        this.getProperties(system),

      requiresAttunement:
        this.requiresAttunement(system)
    };
  }

  static getSubtypeKey(typeKey, system) {
    const typeValue = this.extractValue(
      system.type
    );

    if (typeKey === "equipment") {
      return this.normalize(
        typeValue ||
        system.armor?.type ||
        system.baseItem
      );
    }

    return this.normalize(typeValue);
  }

  static getSubtypeLabel(typeKey, subtypeKey) {
    if (!subtypeKey) return "Other";

    const configCollections = [
      CONFIG.DND5E?.itemTypeLabels,
      CONFIG.DND5E?.weaponTypes,
      CONFIG.DND5E?.equipmentTypes,
      CONFIG.DND5E?.armorTypes,
      CONFIG.DND5E?.consumableTypes,
      CONFIG.DND5E?.toolTypes,
      CONFIG.DND5E?.lootTypes
    ];

    for (const collection of configCollections) {
      const configured =
        collection?.[subtypeKey];

      const label =
        this.extractLabel(configured);

      if (label) return label;
    }

    return this.titleCase(subtypeKey);
  }

  static getItemTypeLabel(typeKey) {
    const configured =
      CONFIG.Item?.typeLabels?.[typeKey] ??
      CONFIG.DND5E?.itemTypes?.[typeKey] ??
      CONFIG.DND5E?.itemTypeLabels?.[typeKey];

    return (
      this.extractLabel(configured) ||
      this.titleCase(typeKey || "item")
    );
  }

  static normalizeRarity(value) {
    let rawValue = value;

    if (
      rawValue &&
      typeof rawValue === "object"
    ) {
      rawValue =
        rawValue.value ??
        rawValue.id ??
        rawValue.key ??
        "";
    }

    const normalized = String(rawValue ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

    const aliases = {
      common: "common",
      uncommon: "uncommon",
      rare: "rare",
      veryrare: "veryrare",
      legendary: "legendary",
      artifact: "artifact"
    };

    return aliases[normalized] ?? "common";
  }

  static getRarityLabel(rarityKey) {
    const normalized =
      this.normalizeRarity(rarityKey);

    const definition =
      this.RARITY_DEFINITIONS.find(
        entry => entry.value === normalized
      );

    return definition?.label ?? "Common";
  }

  static hasUsableSource(sourceData) {
    if (typeof sourceData === "string") {
      return Boolean(sourceData.trim());
    }

    if (!sourceData || typeof sourceData !== "object") {
      return false;
    }

    const candidate =
      sourceData.book ??
      sourceData.title ??
      sourceData.source ??
      sourceData.custom;

    if (candidate && typeof candidate === "object") {
      return Boolean(
        candidate.label ??
        candidate.name ??
        candidate.title ??
        candidate.value ??
        candidate.id ??
        candidate.key
      );
    }

    return candidate !== null &&
      candidate !== undefined &&
      String(candidate).trim() !== "";
  }

  static getSourceBook(sourceData, pack) {
    const candidate = this.extractSourceCandidate(
      sourceData
    );

    if (candidate !== "") {
      return this.resolveSourceBookLabel(candidate);
    }

    return (
      pack.metadata.label ??
      pack.collection
    );
  }

  static extractSourceCandidate(sourceData) {
    if (typeof sourceData === "string") {
      return sourceData.trim();
    }

    if (!sourceData || typeof sourceData !== "object") {
      return "";
    }

    let candidate =
      sourceData.book ??
      sourceData.title ??
      sourceData.source ??
      sourceData.custom ??
      "";

    if (candidate && typeof candidate === "object") {
      candidate =
        candidate.label ??
        candidate.name ??
        candidate.title ??
        candidate.value ??
        candidate.id ??
        candidate.key ??
        "";
    }

    return String(candidate ?? "").trim();
  }

  static resolveSourceBookLabel(book) {
    const rawBook = String(book ?? "").trim();

    if (!rawBook) return "";

    const sourceBooks =
      CONFIG.DND5E?.sourceBooks ??
      CONFIG.DND5E?.sources ??
      {};

    const configured =
      sourceBooks[rawBook] ??
      sourceBooks[this.normalize(rawBook)];

    const configuredLabel =
      this.extractLabel(configured);

    if (configuredLabel) {
      return configuredLabel;
    }

    if (game.i18n?.has?.(rawBook)) {
      return game.i18n.localize(rawBook);
    }

    return rawBook;
  }

  static normalizeSourceKey(source) {
    return this.normalize(source);
  }

  static getProperties(system) {
    const rawProperties = system.properties;
    const keys = [];

    if (rawProperties instanceof Set) {
      keys.push(...rawProperties);
    } else if (Array.isArray(rawProperties)) {
      keys.push(...rawProperties);
    } else if (
      rawProperties &&
      typeof rawProperties === "object"
    ) {
      for (
        const [key, enabled]
        of Object.entries(rawProperties)
      ) {
        if (enabled) keys.push(key);
      }
    }

    return [
      ...new Set(
        keys
          .map(key => this.normalize(key))
          .filter(Boolean)
      )
    ].map(value => ({
      value,
      label:
        this.extractLabel(
          CONFIG.DND5E?.itemProperties?.[value]
        ) ||
        this.titleCase(value)
    }));
  }

  static requiresAttunement(system) {
    const attunement = this.extractValue(
      system.attunement
    );

    if (
      attunement === null ||
      attunement === undefined ||
      attunement === ""
    ) {
      return false;
    }

    if (typeof attunement === "boolean") {
      return attunement;
    }

    if (typeof attunement === "number") {
      return attunement > 0;
    }

    const normalized =
      this.normalize(attunement);

    return ![
      "",
      "none",
      "0",
      "false"
    ].includes(normalized);
  }

  static passesScalarFacet(value, filter = {}, normalizer = value => this.normalize(value)) {
    const normalized = normalizer(value);
    const includes = new Set((filter.include ?? []).map(normalizer));
    const excludes = new Set((filter.exclude ?? []).map(normalizer));

    if (excludes.has(normalized)) return false;
    if (includes.size && !includes.has(normalized)) return false;
    return true;
  }

  static passesArrayFacet(values, filter = {}) {
    const normalizedValues = new Set(
      (values ?? []).map(value => this.normalize(value?.value ?? value))
    );
    const includes = new Set((filter.include ?? []).map(value => this.normalize(value)));
    const excludes = new Set((filter.exclude ?? []).map(value => this.normalize(value)));

    for (const excluded of excludes) {
      if (normalizedValues.has(excluded)) return false;
    }

    if (includes.size) {
      const matchesAny = [...includes].some(value => normalizedValues.has(value));
      if (!matchesAny) return false;
    }

    return true;
  }

  static passesFilters(row, filters = {}) {
    const search = this.normalize(filters.search);
    const minPrice = Number(filters.minPrice);
    const maxPrice = Number(filters.maxPrice);

    if (search && !this.normalize(row.name).includes(search)) return false;

    if (!this.passesScalarFacet(row.typeKey, filters.types)) return false;
    if (!this.passesScalarFacet(
      row.rarityKey,
      filters.rarities,
      value => this.normalizeRarity(value)
    )) return false;
    if (!this.passesScalarFacet(
      row.sourceKey,
      filters.sources,
      value => this.normalizeSourceKey(value)
    )) return false;
    if (!this.passesScalarFacet(row.subtypeKey, filters.subtypes)) return false;
    if (!this.passesArrayFacet(row.properties, filters.properties)) return false;

    if (filters.attunement === "required" && !row.requiresAttunement) return false;
    if (filters.attunement === "not-required" && row.requiresAttunement) return false;

    if (
      filters.affordableOnly &&
      Number.isFinite(filters.availableCurrencyCp) &&
      row.buyPriceCp > filters.availableCurrencyCp
    ) return false;

    if (
      Number.isFinite(minPrice) &&
      filters.minPrice !== "" &&
      row.buyPriceCp < minPrice * 100
    ) return false;

    if (
      Number.isFinite(maxPrice) &&
      filters.maxPrice !== "" &&
      row.buyPriceCp > maxPrice * 100
    ) return false;

    return true;
  }

  static async buyCompendiumItem({
    actor,
    packId,
    documentId
  }) {
    if (
      !game.settings.get(
        MODULE_ID,
        "enableBuying"
      )
    ) {
      ui.notifications.warn(
        "Buying is disabled."
      );

      return;
    }

    const allowedPackIds =
      this.getAllowedPackIds();

    if (!allowedPackIds.includes(packId)) {
      ui.notifications.error(
        "That compendium is not allowed."
      );

      return;
    }

    const pack = game.packs.get(packId);

    if (!pack) {
      ui.notifications.error(
        "Compendium not found."
      );

      return;
    }

    const item =
      await pack.getDocument(documentId);

    if (!item) {
      ui.notifications.error(
        "Item not found."
      );

      return;
    }

    const currentShop =
      ShopService.getCurrentShop();

    let priceCp =
      PricingService.getItemPriceCp(item);

    priceCp =
      PricingService.applyShopModifier(
        priceCp,
        currentShop
      );

    if (
      !CurrencyService.canAfford(
        actor,
        priceCp
      )
    ) {
      ui.notifications.warn(
        "You cannot afford that item."
      );

      return;
    }

    if (TransactionApprovalService.requiresApproval("buy")) {
      await TransactionApprovalService.requestBuy({
        actor,
        packId,
        documentId,
        item,
        priceCp
      });
      return;
    }

    const originalCurrencyCp = CurrencyService.currencyToCp(
      CurrencyService.getCurrency(actor)
    );

    await CurrencyService.deductCurrency(
      actor,
      priceCp
    );

    try {
      await actor.createEmbeddedDocuments(
        "Item",
        [item.toObject()]
      );
    } catch (error) {
      await CurrencyService.setCurrency(actor, originalCurrencyCp);
      throw error;
    }

    await TransactionService.post({
      type: "buy",
      actor,
      itemName: item.name,
      quantity: 1,
      priceCp
    });
  }

  static dedupeRows(rows) {
    const seen = new Map();

    for (const row of rows) {
      const key = [
        this.normalize(row.name),
        row.typeKey,
        this.normalizeSourceKey(row.sourceKey),
        row.buyPriceCp ?? 0
      ].join("|");

      if (!seen.has(key)) {
        seen.set(key, row);
      }
    }

    return Array.from(seen.values());
  }

  static extractValue(value) {
    if (
      value &&
      typeof value === "object" &&
      "value" in value
    ) {
      return value.value;
    }

    return value;
  }

  static extractLabel(value) {
    if (!value) return "";

    const label =
      typeof value === "string"
        ? value
        : value.label ??
          value.name ??
          value.title ??
          "";

    if (!label) return "";

    return game.i18n?.has?.(label)
      ? game.i18n.localize(label)
      : label;
  }

  static normalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }

  static titleCase(value) {
    return String(value ?? "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .replace(
        /\b\w/g,
        character => character.toUpperCase()
      );
  }
}