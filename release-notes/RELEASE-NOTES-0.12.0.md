# Morelord Marketplace 0.12.0

## What Changed

### Added

- **Enable Locations** is a world setting, off by default. When it is on, buying and selling require the current location to have a Marketplace capability. The global Marketplace only trades items of that capability's rarity or lower.
- The current location is Morelord Core's location for the scene the shopper is viewing. An active Downtime session uses that session's location instead, including On the Road when the session has no location.
- A shop's own stock and purchase rules override the location rarity. A shop can still buy and sell a rarer item it stocks when the location Marketplace is a lower tier. No Marketplace at the location blocks shop trading as well.
- Blocked purchases and sales show a warning. The same check runs again when a Game Master client completes a cart, shop checkout, or approval, using the shopper's viewed scene.

## Compatibility

Requires Morelord Core 0.7.0 or newer. Core already registers the Marketplace capability type. The Foundry minimum remains 14. `module.json` still records compatibility verified on 14.369; this change was not re-checked in a live world.

## Verification

`node --test test/*.test.mjs`: 59 passed, 0 failed. New tests cover location gating, the rarity limit, shop stock overriding that limit, Downtime's active session and On the Road, and Core's `meetsTier` / `evaluateRequirements` for the same decisions. There is no separate build step. Live Foundry verification in Dev1 is outstanding.
