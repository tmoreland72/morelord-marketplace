# Morelord Marketplace 0.7.0

## Added

- Added live shop inventory management to Manage Shops, including compendium item search, persistent manual additions and removals, and quantity steppers for limited stock.
- Added unsaved shop previews so store templates and prefab stores are not created until the GM selects Create Shop.

## Improved

- Reorganized shop inventory, restocking, product, and current-inventory settings for faster GM access.
- Kept shop actions visible while the settings panel scrolls and preserved list positions across interface rerenders.
- Replaced submit-style inventory search with fast, debounced search that retains keyboard focus.
- Increased the default size of Marketplace windows and widened vendor windows for the item list and cart.
- Standardized item source labels as publication names, with Craftworks used for Morelord Craftworks content.

## Fixed

- Prevented unsupported scheduled restocking choices from appearing.
- Prevented generic compendium labels such as Items or Equipment from appearing as item sources.
- Prevented inventory changes and other list actions from resetting scroll positions.
- Preserved GM inventory overrides when a shop is restocked.
