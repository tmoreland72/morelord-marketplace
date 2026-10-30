# Morelord Marketplace 0.12.0

## What Changed

### Added

- **Enable Locations** is a world setting, off by default. When it is on, buying and selling require the current location to have a Marketplace capability. Buy omits items above that tier from the catalog, item count, rarity counts, and pages. Sell still lists owned items above the tier and disables their sell buttons; the tooltip explains the limit.
- The current location is Morelord Core's location for the scene the shopper is viewing. An active Downtime session with a chosen location uses that location. A session set to No Location uses the viewed scene's location. On the Road applies only when that session has no location and the viewed scene has none either.
- A shop's own stock and purchase rules override the location rarity. A shop can still buy and sell a rarer item it stocks when the location Marketplace is a lower tier. No Marketplace at the location blocks shop trading as well.
- Blocked purchases and sales show a warning. The same check runs again when a Game Master client completes a cart, shop checkout, or approval, using the shopper's viewed scene.
- Requires Morelord Core 0.9.0 or newer. Configure Sources, rate changes, and account access refresh open Marketplace windows in the background. The current place comes from Core's shared active location. Marketplace still uses the viewed scene when that result is the virtual On the Road place and the scene has an associated location.

## Compatibility

Requires Morelord Core 0.9.0 or newer. Core already registers the Marketplace capability type and supplies the shared active location and background window refresh. The Foundry minimum remains 14. `module.json` still records compatibility verified on 14.369; this change was not re-checked in a live world.

## Verification

`node --test test/location-trade.test.mjs`: 12 passed, 0 failed. That includes an explicit Downtime location winning over the viewed scene, a session set to No Location using the scene's location (Phandalin), On the Road remaining when that scene has no location, and Marketplace replacing Core's virtual On the Road result with the viewed scene's location. The full `node --test test/*.test.mjs` suite needs a local Morelord Core checkout; this environment could not clone it, so that suite was not re-run. The previous full run on this branch was 63 passed before this test was added. Live Foundry verification in Dev1 is still outstanding.
