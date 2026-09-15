import test from "node:test";
import assert from "node:assert/strict";
import { CompendiumService } from "../scripts/services/compendium-service.js";
import { PrefabShopService } from "../scripts/services/prefab-shop-service.js";
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
