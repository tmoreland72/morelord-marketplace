# Morelord Marketplace 0.9.3

Shops can inherit rarity capabilities from shared Locations, and other modules can access Marketplace item-sourcing services.

## What Changed

### Added

- Added shared Location selection and an optional maximum normal rarity to shop configuration, while allowing manually included inventory above that limit.
- Added a GM shortcut to the Core Location Manager.
- Exposed shop capabilities, magic-item wishlists, random item selection, and sourcing investment operations through the module API.

### Improvements

- Used Core's shared source-book label resolver for catalog sources.
- Updated the example publishing configuration for website and Foundry release tokens.

## Validation

- All three shop-capability tests passed.
- Live Foundry UI testing was not performed for this release.
