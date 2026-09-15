import test from "node:test";
import assert from "node:assert/strict";
import { PricingService } from "../scripts/services/pricing-service.js";
import { ShopService } from "../scripts/services/shop-service.js";
import { ShopProfileModel } from "../scripts/models/shop-profile.js";

test("global buy rate multiplies prices, guards the minimum, and leaves shops independent", () => {
  let rate;
  globalThis.game = { settings: { get: () => rate } };
  for (const [value, expected] of [[undefined, 101], [1, 101], [1.5, 152], [0.5, 101], [NaN, 101], [Infinity, 101]]) {
    rate = value;
    assert.equal(PricingService.getBuyPriceCp(101), expected);
    assert.equal(PricingService.applyShopModifier(101, null), expected);
  }
  const original = ShopService.getReputationTier;
  try {
    rate = 3;
    ShopService.getReputationTier = () => ({ buyModifier: 1 });
    assert.equal(PricingService.getBuyPriceCp(100, { buyModifier: 1.2 }), 120);
    ShopService.getReputationTier = () => ({ buyModifier: null });
    assert.equal(PricingService.getBuyPriceCp(100, {}), null);
  } finally {
    ShopService.getReputationTier = original;
    delete globalThis.game;
  }
});

test("global override uses list price on both sides, preserves settings and leaves shop rates alone", () => {
  const settings = { buyRate: 1.5, sellRate: .4, ignoreGlobalRates: true };
  globalThis.game = { settings: { get: (_module, key) => settings[key] } };
  globalThis.foundry = { utils: { randomID: () => "shop" } };
  assert.equal(PricingService.getBuyPriceCp(1000), 1000);
  assert.equal(PricingService.getSellPriceCp(1000, null, .4), 1000);
  const shop = ShopProfileModel.create({ type: "magic" });
  assert.equal(shop.buyModifier, 1.5);
  assert.equal(shop.sellModifier, .4);
  assert.equal(PricingService.getBuyPriceCp(1000, shop), 1500);
  assert.equal(PricingService.getSellPriceCp(1000, shop), 400);
  settings.ignoreGlobalRates = false;
  assert.equal(PricingService.getBuyPriceCp(1000), 1500);
  assert.equal(PricingService.getSellPriceCp(1000, null, .4), 400);
});
