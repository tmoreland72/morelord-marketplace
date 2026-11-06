# Morelord Marketplace 0.12.2

## What Changed

### Fixed

- When Buy lists a purchasable container, it no longer also lists the items stored inside that container, including items in a nested container. Buying the container still includes those contents at the container's price. A top-level item that is not stored in the container, such as a loose rope, stays listed. Opening the container's item link still shows its contents. Sell and Transfer still show items you already own, including items inside containers.

### Improvements

- Buying a quantity of a stackable item adds that quantity to one stack. It no longer creates one copy of the source stack for each unit.
- When the same item is both a loose listing and a copy stored in a container, Buy keeps the loose listing.
- Completed purchase, sale, and transfer chat cards use Morelord Core's item card. Approval cards keep the Marketplace approval markup, including Approve and Deny.
- Prices and character purses use Morelord Core's currency API.
- `api.open` opens Marketplace the same way as `api.openMarketplace`.
- Requires Morelord Core 0.9.2 or newer. Core 0.9.0 and 0.9.1 do not provide that currency API or item card.

## Compatibility

Requires Morelord Core 0.9.2 or newer. The Foundry minimum remains 14. `module.json` still records compatibility verified on 14.369. Foundry VTT 14.370 is the current stable release and has not been verified in Dev1. Do not publish this release until that check is done.

## Verification

The Release workflow on main lists `test/*.test.mjs` with `Get-ChildItem` and passes each path to `node --test`. `release.config.json` has no `documentationWebsiteRepository`, so `release.ps1` does not dispatch documentation. Foundry and the website are published by `release.ps1`: a normal release publishes both after the GitHub Release, and `publish_only` runs `-WebsiteOnly` and then `-FoundryOnly`. This preparation does not merge, dispatch Release, or run `release.ps1`.

`node --test test/*.test.mjs`: 86 passed, 0 failed. Live Foundry verification in Dev1 is still outstanding. The in-game check is `containerPurchaseCheck` in `scripts/testing/container-purchase.mjs`. It now also confirms Explorer's Pack stays on the Buy catalog and that its indexed contents are not separate Buy listings.
