# Morelord Marketplace 0.12.0

## What Changed

### Added

- **Enable Locations** is a world setting, off by default. When it is on, buying and selling require the current location to have a Marketplace capability. Buy omits items above that tier from the catalog, item count, rarity counts, and pages. Sell still lists owned items above the tier and disables their sell buttons; the tooltip explains the limit.
- The current location is Morelord Core's location for the scene the shopper is viewing. An active Downtime session uses that session's location instead, including On the Road when the session has no location.
- A shop's own stock and purchase rules override the location rarity. A shop can still buy and sell a rarer item it stocks when the location Marketplace is a lower tier. No Marketplace at the location blocks shop trading as well.
- Blocked purchases and sales show a warning. The same check runs again when a Game Master client completes a cart, shop checkout, or approval, using the shopper's viewed scene.
- Requires Morelord Core 0.9.0 or newer. Configure Sources, rate changes, and account access refresh open Marketplace windows in the background. The current place comes from Core's shared active location, including an active Downtime session and On the Road.

## Compatibility

Requires Morelord Core 0.9.0 or newer. Core already registers the Marketplace capability type and supplies the shared active location and background window refresh. The Foundry minimum remains 14. `module.json` still records compatibility verified on 14.369; this change was not re-checked in a live world.

## Verification

`node --test test/*.test.mjs`: 63 passed, 0 failed. New tests cover location gating, the Buy catalog filter, Sell staying listed but disabled above the tier, Core `locations.activeContext` with the local Downtime fallback, and background refresh using `renderInBackground` with `render({ force: false })` when that helper is missing. There is no separate build step. Live Foundry verification of background refresh and the Core 0.9.0 location API in Dev1 is still outstanding.
