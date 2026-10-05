# Morelord Marketplace 0.10.2

## What Changed

### Improvements

- Requires Morelord Core 0.4.2 or newer for shared party inventory access and read-only item previews.

- Documentation opens the website guide; settings includes a Documentation button.
- Party members can use their Group as shopper, payer, or sender without Owner permission; a connected GM validates and applies restricted changes.
- Restricted item links open a read-only Core preview without changing permissions.
- Buy, Sell, and Transfer carts support quantity changes, item removal, and Clear Cart; Sell lists are alphabetical.
- Shopper/Payer and Sender/Recipient controls appear first in their tabs with Core portraits; Wishlist omits these selectors.
- New Shop opens a complete editor; drafts enter Existing Stores only after Save New Shop.
- Add Item opens Core's item picker. Exclusively magical items and Exclude magical items are mutually exclusive.
- Inventory uses one Stock Plan, selects distinct random products, and retains existing inventory and legacy top-up settings.
- Added a manifest changelog link and moved release history into `release-notes/`. Local working files belong in ignored `/tmp/`.

- Release staging and generated ZIP files use module-local `/tmp/`; ZIP validation rejects working files and release-note sources.

### Fixed

- Compact Shop Manager windows keep the editor below the complete shop list. Selected shops use Core's readable list selection states in both themes.

## Verification

Verified with Foundry VTT 14.368 and D&D5e 6.0.3 in Dev1. All 41 module automated tests passed; Core's design-system check passed. GM/player Core checks verified initialization, recipient routing and website documentation links. Marketplace's native inventory, party, container, read-only preview and layout checks passed; Shop Manager was visually reviewed in both themes at 1280px and 700px viewports. A player-only run skips the GM settings window, which passed on the GM client. Full 200% zoom and every consumer workflow are not claimed.
