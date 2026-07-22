import { MODULE_ID, ITEM_TYPES } from "../constants.js";
import { PricingService } from "./pricing-service.js";
import { CurrencyService } from "./currency-service.js";
import { ShopService } from "./shop-service.js";
import { TransactionService } from "./transaction-service.js";

export class CompendiumService {
  static cache = new Map();

  static getAllowedPackIds() {
    return game.settings.get(MODULE_ID, "allowedCompendiums") ?? [];
  }

  static getAllowedPacks() {
    return this.getAllowedPackIds()
      .map(id => game.packs.get(id))
      .filter(Boolean);
  }

  static async getBuyableItems(filters = {}) {
    const packs = this.getAllowedPacks();
    const currentShop = ShopService.getCurrentShop();
    const rows = [];

    for (const pack of packs) {
      const index = await this.getPackIndex(pack);

      for (const entry of index) {
        const row = await this.indexEntryToMarketplaceRow(pack, entry, currentShop);
        if (!row) continue;
        if (!this.passesFilters(row, filters)) continue;

        rows.push(row);
      }
    }

    // This removed deduplication step is intentional. It was causing issues with items that have the same name 
    // but different prices or sources, which are valid scenarios in the marketplace.
    const dedupedRows = this.dedupeRows(rows);
    return dedupedRows.sort((a, b) => a.name.localeCompare(b.name));
    // return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  static async getPackIndex(pack) {
    if (this.cache.has(pack.collection)) {
      return this.cache.get(pack.collection);
    }

    const index = await pack.getIndex({
      fields: [
        "name",
        "type",
        "img",
        "system.price",
        "system.rarity",
        "system.type",
        "system.identifier"
      ]
    });

    this.cache.set(pack.collection, index);
    return index;
  }

  static async indexEntryToMarketplaceRow(pack, entry, shop) {
    // if (!ITEM_TYPES.BUYABLE.includes(entry.type)) return null;

    if (shop && !ShopService.entryPassesShop(entry, shop, pack.collection)) {
      return null;
    }

    const rarity = entry.system?.rarity || "common";

    let priceCp = 0;

    if (entry.system?.price) {
      priceCp = PricingService.getItemPriceCp({ system: entry.system });
    } else {
      // Fallback: load full document if price was not indexed.
      const doc = await pack.getDocument(entry._id);
      priceCp = PricingService.getItemPriceCp(doc);
    }

    if (!priceCp) return null;

    priceCp = PricingService.applyShopModifier(priceCp, shop);


    return {
      documentId: entry._id,
      packId: pack.collection,
      name: entry.name,
      img: entry.img,
      type: entry.type.charAt(0).toUpperCase() + entry.type.slice(1),
      rarity: rarity.charAt(0).toUpperCase() + rarity.slice(1),
      source: pack.metadata.label ?? pack.collection,
      buyPriceCp: priceCp,
      buyPrice: CurrencyService.formatCp(priceCp)
    };
  }

static passesFilters(row, filters) {
  const search = (filters.search ?? "").trim().toLowerCase();
  const type = (filters.type ?? "").trim().toLowerCase();
  const rarity = (filters.rarity ?? "").trim().toLowerCase();

  const rowName = (row.name ?? "").trim().toLowerCase();
  const rowType = (row.type ?? "").trim().toLowerCase();
  const rowRarity = (row.rarity ?? "").trim().toLowerCase();

  if (search && !rowName.includes(search)) return false;
  if (type && rowType !== type) return false;
  if (rarity && rowRarity !== rarity) return false;

  return true;
}

  static async buyCompendiumItem({ actor, packId, documentId }) {
    if (!game.settings.get(MODULE_ID, "enableBuying")) {
      ui.notifications.warn("Buying is disabled.");
      return;
    }

    const allowed = this.getAllowedPackIds();
    if (!allowed.includes(packId)) {
      ui.notifications.error("That compendium is not allowed.");
      return;
    }

    const pack = game.packs.get(packId);
    if (!pack) {
      ui.notifications.error("Compendium not found.");
      return;
    }

    const item = await pack.getDocument(documentId);
    if (!item) {
      ui.notifications.error("Item not found.");
      return;
    }

    const currentShop = ShopService.getCurrentShop();
    let priceCp = PricingService.getItemPriceCp(item);
    priceCp = PricingService.applyShopModifier(priceCp, currentShop);

    if (!CurrencyService.canAfford(actor, priceCp)) {
      ui.notifications.warn("You cannot afford that item.");
      return;
    }

    await CurrencyService.deductCurrency(actor, priceCp);
    await actor.createEmbeddedDocuments("Item", [item.toObject()]);

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
        row.name?.toLowerCase().trim(),
        row.type?.toLowerCase().trim(),
        row.source?.toLowerCase().trim(),
        row.buyPriceCp ?? 0
      ].join("|");

      if (!seen.has(key)) {
        seen.set(key, row);
        continue;
      }

      const existing = seen.get(key);

      // Prefer official PHB over expansion/source duplicates if present
      if (
        row.packId?.includes("players-handbook") &&
        !existing.packId?.includes("players-handbook")
      ) {
        seen.set(key, row);
      }
    }

    return Array.from(seen.values());
  }
}

