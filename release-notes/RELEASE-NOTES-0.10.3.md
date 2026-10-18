# Morelord Marketplace 0.10.3

## Fixed

- Buying filled containers such as Explorer's Pack now includes their source compendium contents. Direct purchases, carts, shop checkout, and GM approvals preserve nested container links, with separate contents for each purchased copy.

## Compatibility

Verified on Foundry VTT 14.369 with D&D5e 6.0.3. Requires Morelord Core 0.4.2 or newer.

## Verification

All 44 automated Marketplace tests passed. All five Core shared-runner checks passed in Dev1, including a direct Explorer's Pack purchase and a two-copy approved cart with complete contents, valid owned containment links, and exact currency deductions. Shop checkout and a real player approval interaction were not separately exercised live.

The fix applies to future purchases; it does not automatically repair previously purchased empty containers. Items listed only in descriptions are not generated.
