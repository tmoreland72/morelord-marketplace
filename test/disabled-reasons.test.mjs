import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { disabledTooltip, setDisabled } from "../../morelord-core/scripts/ui/disabled-reason.js";
import {
  applyDisabledReasons,
  buyAddReason,
  purchaseButtonReason,
  sellAddReason,
  sellCartButtonReason,
  tradeBlockReason,
  transferAddReason,
  transferButtonReason,
  wishlistBuyReason
} from "../scripts/services/disabled-reasons.js";

const aboveTier = {
  allowed: false,
  code: "above-tier",
  location: { name: "Emberwood" },
  capability: { tier: "common" },
  message: "Emberwood's Marketplace trades Common items and lower. This item is above that limit.",
  shortLabel: "Above location limit"
};
const noMarket = {
  allowed: false,
  code: "no-marketplace",
  location: { name: "Camp" },
  message: "Camp has no Marketplace, so nothing can be bought or sold here.",
  shortLabel: "No Marketplace"
};

function legacyPurchaseAllowed(state) {
  const canBuy = !state.placeReason && !state.buyingOffReason;
  return !state.checkingOut
    && !state.shopStale
    && canBuy
    && state.hasShopper
    && state.hasPayer
    && state.cartCount > 0
    && state.canAfford
    && !state.lineReason;
}

function legacySellAllowed(state) {
  const canSell = !state.placeReason && !state.sellingOffReason;
  return !state.checkingOut
    && state.hasShopper
    && state.cartCount > 0
    && canSell
    && !state.shopStale
    && !state.lineReason;
}

test("disabled reasons name the blocker and keep the previous checkout rule", () => {
  const placeReason = tradeBlockReason(noMarket);
  const lineReason = tradeBlockReason(aboveTier);
  assert.equal(placeReason, "No Marketplace\nThis location has no Marketplace capability.");
  assert.equal(lineReason, "Over this location's rarity limit\nEmberwood trades Common items and lower.");
  assert.equal(disabledTooltip(placeReason), "<strong>No Marketplace</strong><br>This location has no Marketplace capability.");
  assert.equal(disabledTooltip(lineReason), "<strong>Over this location's rarity limit</strong><br>Emberwood trades Common items and lower.");
  assert.equal(tradeBlockReason(null), null);
  assert.equal(tradeBlockReason({ allowed: true }), null);

  const ready = {
    checkingOut: false,
    shopStale: false,
    placeReason: null,
    buyingOffReason: null,
    sellingOffReason: null,
    hasShopper: true,
    hasPayer: true,
    cartCount: 1,
    canAfford: true,
    lineReason: null
  };
  const purchaseCases = [
    ready,
    { ...ready, cartCount: 0 },
    { ...ready, canAfford: false },
    { ...ready, placeReason },
    { ...ready, lineReason },
    { ...ready, checkingOut: true },
    { ...ready, shopStale: true },
    { ...ready, buyingOffReason: "Buying is off\nGlobal buying is turned off." },
    { ...ready, hasShopper: false },
    { ...ready, hasPayer: false },
    { ...ready, cartCount: 0, placeReason, canAfford: false }
  ];
  for (const state of purchaseCases) {
    assert.equal(purchaseButtonReason(state) == null, legacyPurchaseAllowed(state), JSON.stringify(state));
  }
  assert.equal(purchaseButtonReason({ ...ready, cartCount: 0 }), "Cart empty\nAdd an item before you purchase.");
  assert.equal(purchaseButtonReason({ ...ready, canAfford: false }), "Not enough gold\nThe cart costs more than you have.");
  assert.equal(purchaseButtonReason({ ...ready, placeReason }), placeReason);
  assert.equal(purchaseButtonReason({ ...ready, lineReason, canAfford: false }), lineReason);

  const sellCases = purchaseCases.map(state => ({ ...state, hasShopper: state.hasShopper }));
  for (const state of sellCases) {
    assert.equal(sellCartButtonReason(state) == null, legacySellAllowed(state), JSON.stringify(state));
  }
  assert.equal(sellCartButtonReason({ ...ready, cartCount: 0 }), "Cart empty\nAdd an item before you sell.");
  assert.equal(sellCartButtonReason({ ...ready, lineReason }), lineReason);
  assert.equal(sellCartButtonReason(ready), null);
});

test("row, stepper, and wishlist reasons stay specific when the control is disabled", () => {
  const locationReason = tradeBlockReason(aboveTier);
  assert.equal(buyAddReason({
    allowed: false,
    hasShopper: true,
    hasPayer: true,
    inStock: true,
    canAfford: false
  }), "Not enough gold\nYou do not have enough to cover this price.");
  assert.equal(buyAddReason({
    allowed: false,
    locationReason,
    hasShopper: true,
    hasPayer: true,
    inStock: true,
    canAfford: true
  }), locationReason);
  assert.equal(buyAddReason({
    allowed: false,
    hasShopper: true,
    hasPayer: true,
    inStock: false,
    canAfford: true
  }), "Out of stock\nThis shop has no more of this item.");
  assert.equal(buyAddReason({ allowed: true, canAfford: false }), null);

  assert.equal(sellAddReason({ allowed: false, locationReason }), locationReason);
  assert.equal(sellAddReason({ allowed: false }), "All in the cart\nNothing more of this item is left to add.");
  assert.equal(sellAddReason({ allowed: true, locationReason }), null);
  assert.equal(transferAddReason({ allowed: false, checkingOut: true }), "Transferring\nWait for this transfer to finish.");
  assert.equal(transferButtonReason({ hasSender: true, hasRecipient: false, cartCount: 2 }), "No recipient\nSelect who receives the items.");
  assert.equal(transferButtonReason({ hasSender: true, hasRecipient: true, cartCount: 1 }), null);

  assert.equal(wishlistBuyReason({ allowed: false, inCatalog: false }), "Unavailable\nThis item is not in the catalog.");
  assert.equal(wishlistBuyReason({
    allowed: false,
    inCatalog: true,
    hasShopper: true,
    hasPayer: true,
    canAfford: false
  }), "Not enough gold\nYou do not have enough to cover this price.");
  assert.equal(wishlistBuyReason({
    allowed: false,
    inCatalog: true,
    locationReason: tradeBlockReason(noMarket),
    hasShopper: true,
    hasPayer: true,
    canAfford: true
  }), tradeBlockReason(noMarket));
  assert.equal(wishlistBuyReason({ allowed: true, inCatalog: false }), null);
});

test("live updates explain the disabled plus and row buttons through Core", () => {
  function control() {
    const attributes = new Map();
    const element = {
      disabled: false,
      setAttribute(name, value) {
        attributes.set(name, String(value));
        if (name === "disabled") this.disabled = true;
      },
      removeAttribute(name) {
        attributes.delete(name);
        if (name === "disabled") this.disabled = false;
      },
      getAttribute(name) {
        return attributes.has(name) ? attributes.get(name) : null;
      }
    };
    return element;
  }
  const purchase = control();
  purchase.setAttribute("data-ml-disabled-reason", "Cart empty\nAdd an item before you purchase.");
  const plus = control();
  const row = {
    getAttribute() {
      return "Not enough gold\nYou do not have enough to cover this price.";
    },
    querySelector() {
      return plus;
    }
  };
  const root = {
    querySelectorAll(selector) {
      if (selector === "[data-ml-disabled-reason]") return [purchase];
      if (selector === "[data-ml-increase-reason]") return [row];
      return [];
    }
  };
  applyDisabledReasons(root, setDisabled);
  applyDisabledReasons(root, setDisabled);
  assert.equal(purchase.disabled, true);
  assert.equal(purchase.getAttribute("aria-disabled"), "true");
  assert.equal(purchase.getAttribute("data-tooltip"), "<strong>Cart empty</strong><br>Add an item before you purchase.");
  assert.equal(plus.getAttribute("data-tooltip"), "<strong>Not enough gold</strong><br>You do not have enough to cover this price.");

  const buy = read("templates/parts/buy-tab.hbs");
  const sell = read("templates/parts/sell-tab.hbs");
  const wishlist = read("templates/parts/wishlist-tab.hbs");
  const inventory = read("templates/parts/inventory-table.hbs");
  assert.match(buy, /disabledReason=purchaseDisabledReason/);
  assert.match(buy, /disabledReason=\.\.\/buyStepperDisabledReason/);
  assert.match(buy, /data-ml-disabled-reason="\{\{addDisabledReason\}\}"/);
  assert.match(buy, /data-ml-increase-reason="\{\{increaseDisabledReason\}\}"/);
  assert.match(sell, /disabledReason=sellCartDisabledReason/);
  assert.match(sell, /disabledReason=\.\.\/sellStepperDisabledReason/);
  assert.match(wishlist, /data-ml-disabled-reason="\{\{buyDisabledReason\}\}"/);
  assert.match(inventory, /data-ml-disabled-reason="\{\{addDisabledReason\}\}"/);
});

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
