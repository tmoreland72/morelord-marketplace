# Morelord Marketplace 0.10.0 — Inventory Transfers

Send items to another character or Group directly from Marketplace, with automatic inventory updates and a clear chat receipt.

## What Changed

### Added

- Transfer items, selected quantities, or entire stacks from your inventory to another player character or Group using the new Transfer tab and Shopping Cart. A connected GM is required; transfers complete automatically without approval or currency changes.

### Improvements

- Marketplace tabs now follow Sell → Transfer → Buy → Wishlist and support keyboard navigation.
- Transfer uses familiar inventory rows, plus/minus cart quantity controls, and a recipient selector with the actor portrait inside it.
- Buy, Sell, and Transfer carts use 30% of the desktop layout. Buy filters collapse and remember their state; Source labels use a fixed width with ellipsis and full-name tooltips.
- Transfer chat receipts match Marketplace's existing transaction cards, showing linked sender, recipient, items, quantities, and the item total.

## Compatibility and verification

Requires Morelord Core 0.4.0 or later. Verified on Foundry VTT 14.368 with D&D5e 6.0.3 in Dev1 as GM and player, in both themes and narrow layouts. All 32 automated Marketplace checks passed. Transfers recheck ownership and quantities and recover failed inventory changes; empty containers before transferring them. Received items arrive unequipped, unattuned, and outside containers.
