import { tierLabel } from "./location-trade.js";

/** A disabled control's reason: a bold tooltip title, then one short line. Null enables the control. */

export function tradeBlockReason(decision) {
  if (!decision || decision.allowed) return null;
  if (decision.code === "no-marketplace") {
    return "No Marketplace\nThis location has no Marketplace capability.";
  }
  if (decision.code === "above-tier") {
    const place = decision.location?.name || "This place";
    return `Over this location's rarity limit\n${place} trades ${tierLabel(decision.capability?.tier)} items and lower.`;
  }
  if (decision.code === "locations-unavailable") {
    return "Locations unavailable\nUpdate Morelord Core, or turn off Enable Locations.";
  }
  if (decision.code === "shop-rules") {
    return "Not traded here\nThis shop does not trade this item.";
  }
  const title = decision.shortLabel || "Unavailable";
  const line = decision.message || "This action is not available.";
  return `${title}\n${line}`;
}

export function buyingDisabledReason({ shop = false } = {}) {
  return shop
    ? "Buying is off\nThis shop is not selling right now."
    : "Buying is off\nGlobal buying is turned off.";
}

export function sellingDisabledReason({ shop = false } = {}) {
  return shop
    ? "Selling is off\nThis shop is not accepting sales."
    : "Selling is off\nGlobal selling is turned off.";
}

export function checkoutStepperReason(action) {
  if (action === "sell") return "Selling\nWait for this sale to finish.";
  if (action === "transfer") return "Transferring\nWait for this transfer to finish.";
  return "Purchasing\nWait for this purchase to finish.";
}

const ALL_IN_CART = "All in the cart\nNothing more of this item is left to add.";
const NOT_ENOUGH_NEXT = "Not enough gold\nYou do not have enough to cover this price.";
const OUT_OF_STOCK = "Out of stock\nThis shop has no more of this item.";
const NO_SHOPPER = "No shopper\nSelect who is shopping.";
const NO_PAYER = "No payer\nSelect who pays.";

export function purchaseButtonReason({
  checkingOut = false,
  shopStale = false,
  placeReason = null,
  buyingOffReason = null,
  hasShopper = false,
  hasPayer = false,
  cartCount = 0,
  canAfford = false,
  lineReason = null
} = {}) {
  if (checkingOut) return checkoutStepperReason("buy");
  if (shopStale) return "Shop changed\nRefresh this shop before you purchase.";
  if (placeReason) return placeReason;
  if (buyingOffReason) return buyingOffReason;
  if (!hasShopper) return NO_SHOPPER;
  if (!hasPayer) return NO_PAYER;
  if (!cartCount) return "Cart empty\nAdd an item before you purchase.";
  if (lineReason) return lineReason;
  if (!canAfford) return "Not enough gold\nThe cart costs more than you have.";
  return null;
}

export function sellCartButtonReason({
  checkingOut = false,
  hasShopper = false,
  placeReason = null,
  sellingOffReason = null,
  shopStale = false,
  cartCount = 0,
  lineReason = null
} = {}) {
  if (checkingOut) return checkoutStepperReason("sell");
  if (!hasShopper) return NO_SHOPPER;
  if (placeReason) return placeReason;
  if (sellingOffReason) return sellingOffReason;
  if (shopStale) return "Shop changed\nRefresh this shop before you sell.";
  if (!cartCount) return "Cart empty\nAdd an item before you sell.";
  if (lineReason) return lineReason;
  return null;
}

export function transferButtonReason({
  checkingOut = false,
  hasSender = false,
  hasRecipient = false,
  cartCount = 0
} = {}) {
  if (checkingOut) return checkoutStepperReason("transfer");
  if (!hasSender) return "No sender\nSelect who is sending items.";
  if (!hasRecipient) return "No recipient\nSelect who receives the items.";
  if (!cartCount) return "Cart empty\nAdd an item before you transfer.";
  return null;
}

export function buyAddReason({
  allowed = false,
  locationReason = null,
  buyingOffReason = null,
  hasShopper = false,
  hasPayer = false,
  inStock = true,
  canAfford = true
} = {}) {
  if (allowed) return null;
  if (locationReason) return locationReason;
  if (buyingOffReason) return buyingOffReason;
  if (!hasShopper) return NO_SHOPPER;
  if (!hasPayer) return NO_PAYER;
  if (!inStock) return OUT_OF_STOCK;
  if (!canAfford) return NOT_ENOUGH_NEXT;
  return "Cannot add\nThis item cannot be added to the cart.";
}

export function sellAddReason({
  allowed = false,
  locationReason = null,
  sellingOffReason = null
} = {}) {
  if (allowed) return null;
  if (locationReason) return locationReason;
  if (sellingOffReason) return sellingOffReason;
  return ALL_IN_CART;
}

export function transferAddReason({ allowed = false, checkingOut = false } = {}) {
  if (allowed) return null;
  if (checkingOut) return checkoutStepperReason("transfer");
  return ALL_IN_CART;
}

export function wishlistBuyReason({
  allowed = false,
  inCatalog = false,
  locationReason = null,
  buyingOffReason = null,
  hasShopper = false,
  hasPayer = false,
  canAfford = true
} = {}) {
  if (allowed) return null;
  if (!inCatalog) return "Unavailable\nThis item is not in the catalog.";
  if (locationReason) return locationReason;
  if (buyingOffReason) return buyingOffReason;
  if (!hasShopper) return NO_SHOPPER;
  if (!hasPayer) return NO_PAYER;
  if (!canAfford) return NOT_ENOUGH_NEXT;
  return "Cannot buy\nThis wish cannot be added to the cart.";
}

/** Live updates for controls the shared partial cannot annotate on its own. */
export function applyDisabledReasons(root, setDisabled) {
  if (typeof setDisabled !== "function" || !root || typeof root.querySelectorAll !== "function") return;
  for (const button of root.querySelectorAll("[data-ml-disabled-reason]")) {
    const reason = button.getAttribute?.("data-ml-disabled-reason");
    if (reason?.trim()) setDisabled(button, reason);
  }
  for (const row of root.querySelectorAll("[data-ml-increase-reason]")) {
    const plus = row.querySelector?.('button[data-delta="1"]');
    const reason = row.getAttribute?.("data-ml-increase-reason");
    if (plus && reason?.trim()) setDisabled(plus, reason);
  }
}
