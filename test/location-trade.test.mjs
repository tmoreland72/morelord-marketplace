import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRequirements, meetsTier } from "../../morelord-core/scripts/location/location-domain.js";
import {
  describeLocationTrade,
  evaluateLocationTrade,
  filterBuyCatalog,
  locationFromActiveContext,
  normalizeTradeRarity,
  resolveTradingLocation,
  sceneIdForUser,
  selectMarketplaceCapability,
  sellLocationState
} from "../scripts/services/location-trade.js";

const commonMarket = {
  id: "hamlet",
  name: "Emberwood",
  capabilities: [{ type: "marketplace", tier: "common" }]
};
const rareMarket = {
  id: "city",
  name: "Waterdeep",
  capabilities: [
    { type: "forge", tier: "legendary" },
    { type: "marketplace", tier: "common" },
    { type: "marketplace", tier: "rare" }
  ]
};
const curios = { id: "curios", name: "Curios" };

test("locations off leaves buying and selling unchanged", () => {
  const decision = evaluateLocationTrade({ enabled: false, location: null, rarity: "legendary" });
  assert.equal(decision.allowed, true);
  assert.equal(decision.code, "disabled");
  assert.equal(describeLocationTrade({ enabled: false }).message, null);
});

test("buying and selling require a Marketplace capability", () => {
  for (const location of [null, { name: "Camp", capabilities: [{ type: "forge", tier: "legendary" }] }]) {
    const buy = evaluateLocationTrade({ enabled: true, location, rarity: "common" });
    const sell = evaluateLocationTrade({ enabled: true, location, rarity: "common", shop: curios, shopAllowsItem: true });
    assert.equal(buy.allowed, false);
    assert.equal(sell.allowed, false);
    assert.equal(buy.code, "no-marketplace");
    assert.match(buy.message, /no Marketplace, so nothing can be bought or sold here/);
  }
  const road = evaluateLocationTrade({
    enabled: true,
    location: { name: "On the Road", capabilities: [] },
    rarity: "common"
  });
  assert.equal(road.allowed, false);
  assert.match(road.message, /^On the Road has no Marketplace/);
});

test("a missing Locations service blocks trade when the setting is on", () => {
  const decision = evaluateLocationTrade({ enabled: true, locationsAvailable: false, rarity: "common" });
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "locations-unavailable");
  assert.match(decision.message, /turn off Enable Locations/);
});

test("Marketplace tier limits global buying and selling to that rarity or lower", () => {
  assert.equal(evaluateLocationTrade({ enabled: true, location: commonMarket, rarity: "common" }).allowed, true);
  const rare = evaluateLocationTrade({ enabled: true, location: commonMarket, rarity: "rare" });
  assert.equal(rare.allowed, false);
  assert.equal(rare.code, "above-tier");
  assert.equal(rare.message, "Emberwood's Marketplace trades Common items and lower. This item is above that limit.");
  assert.equal(evaluateLocationTrade({ enabled: true, location: rareMarket, rarity: "rare" }).allowed, true);
  assert.equal(evaluateLocationTrade({ enabled: true, location: rareMarket, rarity: "very rare" }).allowed, false);
  assert.equal(evaluateLocationTrade({ enabled: true, location: rareMarket, rarity: "artifact" }).allowed, false);
  assert.equal(normalizeTradeRarity(null), "common");
  assert.equal(selectMarketplaceCapability(rareMarket).tier, "rare");
});

test("shop stock overrides the location rarity limit and shop rules still win", () => {
  const stocked = evaluateLocationTrade({
    enabled: true,
    location: commonMarket,
    rarity: "rare",
    shop: curios,
    shopAllowsItem: true
  });
  assert.equal(stocked.allowed, true);
  assert.equal(stocked.code, "shop-override");

  const excluded = evaluateLocationTrade({
    enabled: true,
    location: rareMarket,
    rarity: "common",
    shop: curios,
    shopAllowsItem: false
  });
  assert.equal(excluded.allowed, false);
  assert.equal(excluded.code, "shop-rules");
  assert.equal(excluded.message, "Curios does not trade this item.");

  const summary = describeLocationTrade({ enabled: true, location: commonMarket, shop: curios });
  assert.equal(summary.canTrade, true);
  assert.match(summary.message, /Curios follows its own stock and purchase rules/);
  assert.match(summary.message, /Emberwood's Common Marketplace/);
});

test("Core activeContext supplies the location and the local lookup remains the fallback", () => {
  const phandalin = { id: "phandalin", name: "Phandalin", capabilities: [{ type: "marketplace", tier: "common" }] };
  const api = {
    activeContext(user) {
      assert.equal(user.id, "gm");
      return { location: phandalin, source: "scene", sessionId: null };
    }
  };
  assert.equal(locationFromActiveContext(api, { id: "gm" }, { id: "fallback" }).name, "Phandalin");
  assert.equal(locationFromActiveContext({ activeContext: () => ({ location: null, source: "none" }) }, { id: "gm" }, { id: "fallback" }), null);
  assert.equal(locationFromActiveContext(null, { id: "gm" }, { id: "fallback" }).id, "fallback");
});

test("an active Downtime session replaces the scene, including On the Road", () => {
  const scene = { id: "scene-town", name: "Scene Town", capabilities: [{ type: "marketplace", tier: "legendary" }] };
  const locations = new Map([
    ["waterdeep", rareMarket],
    ["scene-town", scene]
  ]);
  const downtime = { sessions: { live: { status: "active", locationId: "waterdeep" }, old: { status: "finalized", locationId: "scene-town" } } };
  assert.equal(resolveTradingLocation({
    sceneLocation: scene,
    downtimeActive: true,
    downtimeState: downtime,
    getLocation: id => locations.get(id) ?? null
  }).id, "city");
  assert.equal(resolveTradingLocation({
    sceneLocation: scene,
    downtimeActive: true,
    downtimeState: { sessions: { live: { status: "active", locationId: "" } } }
  }).name, "On the Road");
  assert.equal(resolveTradingLocation({
    sceneLocation: scene,
    downtimeActive: false,
    downtimeState: downtime
  }).id, "scene-town");
  assert.equal(sceneIdForUser({ id: "player", viewedScene: "scene-7" }, { localUserId: "gm", localSceneId: "scene-1" }), "scene-7");
  assert.equal(sceneIdForUser({ id: "gm" }, { localUserId: "gm", localSceneId: "scene-1" }), "scene-1");
});

const catalog = [
  { name: "Rope", rarityKey: "common" },
  { name: "Torch", rarityKey: "common" },
  { name: "Potion of Healing", rarityKey: "uncommon" },
  { name: "Cloak of Protection", rarityKey: "rare" },
  { name: "Armor of Resistance", rarityKey: "veryrare" },
  { name: "Ring of Wishes", rarityKey: "legendary" },
  { name: "Deck of Many Things", rarityKey: "artifact" }
];

test("the Buy catalog omits items above the location tier, including counts and pages", () => {
  const visible = filterBuyCatalog(catalog, { enabled: true, location: commonMarket });
  assert.deepEqual(visible.map(row => row.name), ["Rope", "Torch"]);
  const counts = new Map();
  for (const row of visible) counts.set(normalizeTradeRarity(row.rarityKey), (counts.get(normalizeTradeRarity(row.rarityKey)) ?? 0) + 1);
  assert.equal(counts.get("common"), 2);
  for (const rarity of ["uncommon", "rare", "veryRare", "legendary", "artifact"]) {
    assert.equal(counts.get(rarity) ?? 0, 0);
  }
  const pageSize = 1;
  const pageCount = Math.ceil(visible.length / pageSize);
  assert.equal(visible.length, 2);
  assert.equal(pageCount, 2);
  assert.deepEqual(visible.slice(0, pageSize).map(row => row.rarityKey), ["common"]);
  assert.equal(filterBuyCatalog(catalog, { enabled: false, location: commonMarket }).length, catalog.length);
  assert.equal(filterBuyCatalog(catalog, { enabled: true, location: { name: "Camp", capabilities: [] } }).length, 0);
});

test("shop stock remains in the Buy catalog above the location tier", () => {
  const visible = filterBuyCatalog(catalog, { enabled: true, location: commonMarket, shop: curios });
  assert.equal(visible.length, catalog.length);
  assert.ok(visible.some(row => row.rarityKey === "legendary"));
  assert.ok(visible.some(row => row.rarityKey === "veryrare"));
  assert.equal(filterBuyCatalog(catalog, {
    enabled: true,
    location: { name: "Camp", capabilities: [] },
    shop: curios
  }).length, 0);
});

test("Sell lists every owned item and disables those above the location tier", () => {
  const rows = catalog.map(row => ({ ...row, ...sellLocationState(row.rarityKey, { enabled: true, location: commonMarket }) }));
  assert.equal(rows.length, catalog.length);
  assert.equal(rows.every(row => row.listed), true);
  assert.equal(rows.find(row => row.name === "Rope").canSell, true);
  assert.equal(rows.find(row => row.name === "Rope").reason, null);
  for (const name of ["Potion of Healing", "Cloak of Protection", "Armor of Resistance", "Ring of Wishes", "Deck of Many Things"]) {
    const row = rows.find(entry => entry.name === name);
    assert.equal(row.canSell, false);
    assert.match(row.reason, /Emberwood's Marketplace trades Common items and lower/);
  }
  const shopLegendary = sellLocationState("legendary", { enabled: true, location: commonMarket, shop: curios });
  assert.equal(shopLegendary.listed, true);
  assert.equal(shopLegendary.canSell, true);
  assert.equal(shopLegendary.reason, null);
});

test("Core capability evaluation and meetsTier enforce the same gate", () => {
  const evaluation = evaluateRequirements(
    [{ kind: "capability", type: "marketplace", tier: "common" }],
    { location: rareMarket }
  );
  const capability = evaluation.results.find(result => result.kind === "capability").actual;
  assert.equal(capability.tier, "rare");
  assert.equal(meetsTier(capability.tier, "rare"), true);
  assert.equal(meetsTier(capability.tier, "veryRare"), false);
  assert.equal(evaluateLocationTrade({ enabled: true, location: rareMarket, capability, rarity: "uncommon", meetsTier }).allowed, true);
  assert.equal(evaluateLocationTrade({ enabled: true, location: rareMarket, capability, rarity: "veryRare", meetsTier }).allowed, false);
  assert.equal(evaluateLocationTrade({ enabled: true, location: rareMarket, capability, rarity: "artifact", meetsTier }).allowed, false);
  const override = evaluateLocationTrade({
    enabled: true,
    location: commonMarket,
    capability: { type: "marketplace", tier: "common" },
    rarity: "legendary",
    shop: curios,
    shopAllowsItem: true,
    meetsTier
  });
  assert.equal(override.allowed, true);
  assert.equal(override.code, "shop-override");
});
