import test from "node:test";
import assert from "node:assert/strict";
import { inventoryEntryAllowedByCapability, normalizeCapabilityTier, rarityWithinCapability } from "../scripts/services/shop-capability.js";

test("shop capability tiers use the shared Common through Legendary ordering", () => {
  assert.equal(normalizeCapabilityTier("Very Rare"), "veryRare");
  assert.equal(rarityWithinCapability("rare", "common"), false);
  assert.equal(rarityWithinCapability("rare", "rare"), true);
  assert.equal(rarityWithinCapability("rare", "veryRare"), true);
});

test("an unspecified capability tier preserves legacy rarity filtering", () => {
  assert.equal(rarityWithinCapability("legendary", null), true);
});

test("GM-added inventory may exceed the shop capability tier", () => {
  assert.equal(inventoryEntryAllowedByCapability({ rarity: "rare", capabilityTier: "common" }), false);
  assert.equal(inventoryEntryAllowedByCapability({ rarity: "rare", capabilityTier: "common", manuallyIncluded: true }), true);
});
