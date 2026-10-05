# Morelord Marketplace 0.9.7

## What Changed

### Improvements

- Fixed v6 rare Items being classified as Common/nonmagical in catalogs and shop validation. Supports both rarity index fields and legacy data through Core 0.3.8.
- Verified Foundry compatibility is explicitly recorded as 14.367; existing Foundry and system support minimums remain unchanged.
- Release guidelines require checking the latest stable Foundry build and confirming the published Foundry listing.

## Validation

- 11 automated tests pass, including legacy/v6 rarity and shop restriction regressions. A live native v6 rare Item now produces Rare/magical classification on Foundry 14.367 / D&D 5e 6.0.1.
- Legacy rarity compatibility is regression-tested; a live pre-v6 world was not available.
