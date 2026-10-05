# Morelord Marketplace 0.9.0

This release improves Marketplace browsing performance, streamlines source configuration, and polishes the shopping and Shop Manager interfaces.

## Changes

- Added a paginated Buy catalog with full-width previous, status, and next controls.
- Improved Buy catalog startup by sharing in-flight index/catalog work, prewarming the catalog, processing indexes concurrently, and keeping browsing index-only.
- Reduced per-page work by decorating only visible Buy rows.
- Added separate List Price and Selling Price columns while removing Type and Category columns from Marketplace tables.
- Reordered Buy filters and aligned wishlist/cart actions horizontally.
- Updated Shopping As and Paying As defaults to prefer the user's character, active character, then an eligible Group actor.
- Positioned the Sell cart beside inventory and enlarged existing-store cards in Shop Manager.
- Simplified Marketplace Settings and made D&D5e Configure Sources the single source of truth for catalogs, checkout validation, approvals, and prefab shops.
- Standardized Settings scrolling so the window owns the scrollbar instead of its content list.
