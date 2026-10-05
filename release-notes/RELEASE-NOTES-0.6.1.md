# Morelord Marketplace 0.6.1

## Added

- Added character and group actor selectors for shopping and payment in both the global Marketplace and vendor shops.
- Added quantity steppers to shop inventory rows and shopping-cart entries.

## Improved

- Redesigned shopping-cart item cards with clearer pricing and compact quantity controls.
- Kept Marketplace filter, result, and cart scroll positions stable while the interface rerenders.
- Aligned shop configuration checkbox labels consistently beside their controls.

## Fixed

- Fixed selling from owned character and group inventories through the global Marketplace and vendor shops.
- Fixed stale shop inventory remaining visible after restocking.
- Added explicit cross-client inventory refresh notifications after a GM restocks a shop.
- Fixed shop checkout incorrectly rejecting products that were visibly available in the shop catalog.
- Made manual restocking save the currently displayed shop configuration before generating inventory.
