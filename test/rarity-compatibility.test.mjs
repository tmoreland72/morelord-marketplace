import test from "node:test";
import assert from "node:assert/strict";
import { CompendiumService } from "../scripts/services/compendium-service.js";
import { resolveBookLabel } from "../../morelord-core/scripts/services/source-book-service.js";
import { inventoryEntryAllowedByCapability } from "../scripts/services/shop-capability.js";

test("legacy and v6 indexed magic items keep their rarity and shop capability restrictions", async () => {
  globalThis.CONFIG = { DND5E: {}, Item: { typeLabels: {} } };
  globalThis.game = { settings: { get: () => 1 }, modules: new Map(), system: {}, i18n: { localize: x => x } };
  globalThis.MorelordCore = { sources: { resolveBookLabel } };
  const pack = { collection: "test.rarity", getIndex: async ({ fields }) => {
    assert.ok(fields.includes("system.rarity"));
    assert.ok(fields.includes("system.rarities"));
    assert.ok(fields.includes("system.quantity"));
    assert.ok(fields.includes("system.container"));
    return [];
  } };
  await CompendiumService.getPackIndex(pack);
  for (const rarity of [{ rarity: "rare" }, { rarities: ["rare"] }, { rarities: new Set(["rare"]) }, { rarities: ["legendary", "rare"] }]) {
    const row = CompendiumService.indexEntryToMarketplaceRow(pack, {
      _id: "rare", name: "Rare item", type: "loot", system: { ...rarity, price: { value: 100, denomination: "gp" } }
    });
    assert.equal(row.rarityKey, "rare");
    assert.equal(row.isMagicItem, true);
    assert.equal(inventoryEntryAllowedByCapability({ rarity: row.rarityKey, capabilityTier: "common" }), false);
  }
  const mundane = CompendiumService.indexEntryToMarketplaceRow(pack, {
    _id: "mundane", name: "Mundane item", type: "loot", system: { rarities: [], rarity: "rare", price: { value: 1, denomination: "gp" } }
  });
  assert.equal(mundane.isMagicItem, false);
});

test("unpriced known-rarity entries are retained by the catalog without document loading", () => {
  globalThis.CONFIG = { DND5E: {}, Item: { typeLabels: {} } };
  globalThis.game = { settings: { get: () => 1 }, modules: new Map(), system: {}, i18n: { localize: x => x } };
  globalThis.MorelordCore = { sources: { resolveBookLabel } };
  const pack = { collection: 'test.rarity' };
  const entry = { _id: 'unpriced', name: 'Unpriced rare item', type: 'consumable', system: { rarities: ['rare'], price: { value: 0, denomination: 'gp' } } };
  const row = CompendiumService.indexEntryToMarketplaceRow(pack, entry);
  assert.equal(row.listPriceCp, 400000);
  assert.equal(row.buyPriceCp, 400000);
  for (const type of ['feat', 'spell', 'class', 'subclass', 'background', 'race']) {
    assert.equal(CompendiumService.indexEntryToMarketplaceRow(pack, { ...entry, type }), null);
  }
  entry.flags = { 'morelord-marketplace': { purchasable: false } };
  assert.equal(CompendiumService.indexEntryToMarketplaceRow(pack, entry), null);
});

test("dedupe keeps a loose listing ahead of pack contents, then the smaller stack", () => {
  const rations = { name: "Rations", typeKey: "consumable", sourceKey: "phb", buyPriceCp: 50 };
  const rows = CompendiumService.dedupeRows([
    { ...rations, documentId: "priest-pack", contained: true, stackSize: 7 },
    { ...rations, documentId: "phbagRations0000", contained: false, stackSize: 1 },
    { name: "Torch", typeKey: "loot", sourceKey: "phb", buyPriceCp: 1, documentId: "ten", contained: false, stackSize: 10 },
    { name: "Torch", typeKey: "loot", sourceKey: "phb", buyPriceCp: 1, documentId: "two", contained: false, stackSize: 2 },
    { name: "Rope", typeKey: "loot", sourceKey: "phb", buyPriceCp: 1, documentId: "first", contained: false, stackSize: 1 },
    { name: "Rope", typeKey: "loot", sourceKey: "phb", buyPriceCp: 1, documentId: "second", contained: false, stackSize: 1 }
  ]);
  assert.equal(rows.find(row => row.name === "Rations").documentId, "phbagRations0000");
  assert.equal(rows.find(row => row.name === "Torch").documentId, "two");
  assert.equal(rows.find(row => row.name === "Rope").documentId, "first");
});
