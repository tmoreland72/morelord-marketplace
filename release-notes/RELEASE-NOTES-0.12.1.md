# Morelord Marketplace 0.12.1

## What Changed

### Fixed

- A shop that inherits its rarity from a location uses the highest Marketplace capability on that location. A lower Marketplace listed first no longer caps generated stock below a higher one on the same place. Buying and selling already used the highest tier, and stock generation now follows that same rule.

### Improvements

- Disabled **Purchase**, **Sell Cart**, **Transfer Items**, Add, quantity, and Wishlist Buy controls say why. The tooltip title is the reason, such as **Not enough gold**, **Cart empty**, **No Marketplace**, or **Over this location's rarity limit**, with one short line under it.
- Requires Morelord Core 0.9.0 or newer.

## Compatibility

Requires Morelord Core 0.9.0 or newer. The Foundry minimum remains 14. `module.json` still records compatibility verified on 14.369; this change was not re-checked in a live world.

## Verification

`node --test test/*.test.mjs` covers the highest-tier location rule for shop stock and location trade, in either capability order, and the disabled-reason text for Purchase, Sell Cart, Add, quantity plus, and Wishlist Buy. Core's `setDisabled` supplies the bold tooltip. Live Foundry verification in Dev1 is still outstanding. The in-game check is `disabledReasonCheck` in `scripts/testing/disabled-reasons.mjs`.
