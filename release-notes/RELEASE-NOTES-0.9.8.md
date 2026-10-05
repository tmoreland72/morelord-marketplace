# Morelord Marketplace 0.9.8

Updates to shared reporting and marketplace workflows.

## What Changed

### Improvements

- Added optional marketplace/shop and buy/sell instrumentation through Core, requiring fresh GM consent.
- Requires Core 0.3.9 for the shared source-filter service.
- Shop deletion and inventory removal now use standard Core buttons instead of red buttons.
- Clarified random-inventory help to describe the editable rarity selection counts without mixing in fixed stock-quantity ranges.
- Added a GM global-marketplace toggle for temporary ×1 buy/sell rates. New shops inherit configured rates and remain editable; existing shop prices are preserved.
- Catalogs, prefab matching, and restocks honor excluded SRD provenance, including copied items in other packs. Prefab choices are unique by normalized name; saved IDs remain valid.
- Shop Manager uses the standard Core page header, explains rarity draws versus stock quantities, and removes the Restocking editor section while retaining Restock Now and saved restock metadata.

## Compatibility and verification

Verified release workflows on Foundry VTT 14.368 with D&D5e 6.0.3 in a disposable test world. Supported minimum/maximum bounds are unchanged. Existing Node tests and the shared Core design-system check passed; in-game evidence is retained in the repositories.
