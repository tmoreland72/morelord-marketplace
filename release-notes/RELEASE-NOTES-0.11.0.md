# Morelord Marketplace 0.11.0

## What Changed

### Improvements

- Morelord Marketplace and Manage Marketplace Shops open from Morelord Tools. Marketplace stays available to every user. Manage Marketplace Shops stays GM-only: it refreshes entitlements, warns unless the account has Marketplace Premium or Champion access, and then opens Shop Manager.
- Requires Morelord Core 0.6.0 or newer. An older Core keeps both buttons on the Token controls. The shop-token HUD button is unchanged.

## Compatibility

Verified on Foundry VTT 14.369. Requires Morelord Core 0.6.0 or newer. The Foundry minimum remains 14.

## Verification

All 51 automated Marketplace tests passed (`node --test test/*.test.mjs`), including registry registration, the older-Core Token-palette fallback, and the shop-token HUD button. Live Foundry verification in Dev1 is still outstanding: no Dev1 world is available here, so the Morelord Tools palette, GM and player visibility, and the Premium/Champion warning were not exercised in a running world.
