import test from "node:test";
import assert from "node:assert/strict";
import { PricingService } from "../scripts/services/pricing-service.js";
import { ShopService } from "../scripts/services/shop-service.js";

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
