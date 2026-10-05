# Morelord Marketplace 0.9.4

Consistent shopping sections, readable source names, and more varied random restocks.

## What Changed

### Improvements

- Place shopper and payer controls in their own section below the header.
- Use shared Core sections for Buy, Sell, Wishlist, and loading states, with shared navigation controls and theme colors.
- Mark manually added stock with a Manual pin badge explaining that restocking preserves its remaining quantity.
- Use shared configuration surfaces, Settings action footers, and page-scroll preservation.
- Require Morelord Core 0.3.5 for the shared source and layout updates.

### Fixes

- Replace guaranteed wishlist picks with a modest 1.25x selection weight. Eligible wishlist items can now be missed during a restock, with or without duplicates enabled.
- Resolve catalog source names through Core with the full source and owning pack metadata.
- Correct conflicting Sell-cart sizing and oversized stacked shopper selectors.
- Scope previously unscoped button styles to Marketplace.

## Validation

- Marketplace tests cover wishlist weighting, random stock, duplicate selection, manual-stock exclusion, capability limits, and source names.
- Shared component boundary checks and template rendering checks pass.
- Live Foundry visual and transaction testing was not performed.
