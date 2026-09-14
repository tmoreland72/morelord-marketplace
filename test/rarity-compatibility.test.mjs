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
