import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRequirements, meetsTier } from "../../morelord-core/scripts/location/location-domain.js";
import {
  describeLocationTrade,
  evaluateLocationTrade,
  normalizeTradeRarity,
  resolveTradingLocation,
  sceneIdForUser,
  selectMarketplaceCapability
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
