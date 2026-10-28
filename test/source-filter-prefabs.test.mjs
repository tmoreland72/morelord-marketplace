import test from "node:test";
import assert from "node:assert/strict";
import { CompendiumService } from "../scripts/services/compendium-service.js";
import { PrefabShopService } from "../scripts/services/prefab-shop-service.js";
import { ShopService } from "../scripts/services/shop-service.js";
import { getAllowedPacks, isUuidAllowed, loadAllowedItem } from "../scripts/services/configured-sources.js";
import { resolveBookLabel } from "../../morelord-core/scripts/services/source-book-service.js";

test("excluded SRD packs and copied SRD items stay out of catalog and cache rebuilds on source changes", async () => {
  let configuration = {};
  const pack = { collection: "world.items", documentName: "Item", metadata: { packageType: "world" }, getIndex: async () => [{ _id: "srd", name: "Copied Sword", type: "weapon", system: { price: { value: 10, denomination: "gp" }, source: { book: "SRD 5.1" } } }] };
  const packs = [pack]; packs.get = id => packs.find(entry => entry.collection === id);
  globalThis.game = { system: { id: "dnd5e" }, packs, i18n: { has: () => false, localize: value => value }, modules: new Map([["morelord-core", { api: { sources: { resolveBookLabel } } }]]), settings: { get: (_module, key) => key === "packSourceConfiguration" ? configuration : undefined } };
  globalThis.CONFIG = { DND5E: {} };
  globalThis.MorelordCore = { sources: { resolveBookLabel } };
  CompendiumService.clearCache();
  assert.equal((await CompendiumService.getBuyableCatalog()).length, 1);
  configuration = { "dnd5e.items": false, "dnd5e.tradegoods": false };
  assert.equal((await CompendiumService.getBuyableCatalog()).length, 0);
  configuration = { "world.items": false };
  assert.deepEqual(CompendiumService.getAllowedPackIds(), []);
});

test("prefab picker deduplicates normalized names but old definition IDs remain resolvable", async t => {
  const definitions = [{ id: "old", name: "The Smith’s Shop", matchedCount: 8 }, { id: "new", name: "The Smith's Shop", matchedCount: 12 }];
  t.mock.method(PrefabShopService, "getDefinitions", async () => definitions);
  t.mock.method(PrefabShopService, "resolveDefinition", async definition => definition);
  assert.deepEqual((await PrefabShopService.getAvailablePrefabs()).map(item => item.id), ["new"]);
  assert.equal((await PrefabShopService.getPrefab("old")).id, "old");
});

test("disabled compendiums are not loaded, indexed, or used as a name fallback", async () => {
  const indexed = [];
  const opened = [];
  const enabled = {
    collection: "world.items",
    documentName: "Item",
    metadata: { packageType: "world", label: "World Items" },
    getIndex: async () => {
      indexed.push("world.items");
      return [];
    },
    getDocument: async () => {
      opened.push("world.items");
      return { name: "Copied Sword", type: "weapon", system: { source: { book: "SRD 5.1" } } };
    }
  };
  const disabled = {
    collection: "dnd5e.items",
    documentName: "Item",
    metadata: { packageName: "dnd5e", label: "Items" },
    getIndex: async () => {
      indexed.push("dnd5e.items");
      return [{ _id: "sword", name: "Longsword", type: "weapon", system: { source: { book: "SRD 5.1" }, price: { value: 15, denomination: "gp" } } }];
    },
    getDocument: async () => {
      opened.push("dnd5e.items");
      return { name: "Longsword", type: "weapon", system: {} };
    }
  };
  const packs = [enabled, disabled];
  packs.get = id => packs.find(entry => entry.collection === id);
  globalThis.game = {
    system: { id: "dnd5e" },
    packs,
    i18n: { has: () => false, localize: value => value },
    modules: new Map([["morelord-core", { api: { sources: { resolveBookLabel } } }]]),
    settings: {
      get: (_module, key) => key === "packSourceConfiguration"
        ? { "dnd5e.items": false, "dnd5e.tradegoods": false }
        : undefined
    }
  };
  globalThis.CONFIG = { DND5E: {} };
  globalThis.MorelordCore = { sources: { resolveBookLabel } };
  CompendiumService.clearCache();
  PrefabShopService.clearCache();

  assert.deepEqual(getAllowedPacks().map(pack => pack.collection), ["world.items"]);
  assert.equal(isUuidAllowed("Compendium.dnd5e.items.Item.sword"), false);
  assert.equal(isUuidAllowed("Actor.hero.Item.owned"), true);
  assert.equal((await loadAllowedItem("dnd5e.items", "sword")).status, "denied");
  assert.equal(opened.includes("dnd5e.items"), false);
  assert.equal((await loadAllowedItem("world.items", "srd")).status, "denied");

  await PrefabShopService.buildItemLookup();
  assert.equal(indexed.includes("dnd5e.items"), false);

  const sourceless = { name: "Longsword", type: "weapon", uuid: "Actor.hero.Item.owned", _stats: {}, getFlag: () => undefined };
  assert.equal(ShopService.acceptsPlayerItem(sourceless, {
    allowSelling: true,
    purchaseItems: [{ uuid: "Compendium.dnd5e.items.Item.sword", name: "Longsword", type: "weapon" }]
  }), false);
});
