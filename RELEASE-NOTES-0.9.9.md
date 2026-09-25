# Morelord Marketplace 0.9.9

## Improvements

- [Premium] Shop Manager supports an exclusive list of items players can sell to a shop, checked both in the Sell tab and at checkout.
- [Premium] Shops can offer only manually added products; restocking restores their configured quantities without introducing random items.
- [Premium] Exclude magical items filters the Magical property across listings, restock candidates, and checkout, independently of rarity.
- [Premium] Purchase lists and inventory share Core section actions and item-row presentation.

## Fixed

- Configured-source items without a positive price now use standard rarity base values. Blank or mundane rarity uses Common at 100 gp, restoring items such as Grenade, Fragmentation to the catalog. Explicit prices and GM overrides take priority; normal buy/sell rates still apply.

- Buy catalogs and checkout enforce supported physical item types, excluding spells and character features even when rarity pricing is available.

## Compatibility and verification

Requires Morelord Core 0.3.15. Verified on Foundry VTT 14.368 with D&D5e 6.0.3 in Dev1. All 24 automated tests passed. Live regressions cover rarity fallback, the fragmentation grenade, and manual shop policies without purchases or campaign inventory changes.
