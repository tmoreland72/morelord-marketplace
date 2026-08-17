# Morelord Marketplace 0.6.0

Morelord Marketplace 0.6.0 improves catalog filtering, inventory browsing, and transaction chat cards across the global Marketplace and scene shops.

## Added

- Added separate **Weapon Class** filters for Martial and Simple weapons.
- Added separate **Weapon Range** filters for Melee and Ranged weapons.
- Added **Weapon Masteries** filters whenever weapons are in scope and mastery data is available.
- Added a **Sort by** control to global and shop Sell tabs with Name, Type, Quantity, List Price, and Sell Price options.

## Improved

- Sell inventory defaults to alphabetical Name sorting and uses Name to break ties for all other sort choices.
- Buy filter sidebars preserve their scroll position when a filter change rerenders the Marketplace.
- Weapon-specific facet counts are calculated only from weapon entries, while general category filters remain focused on non-weapon item categories.
- Item names on completed transactions and every approval-card state are now Foundry document links when a UUID is available.
- Sale chat cards prefer an item's original compendium source link so the link can survive selling the final owned copy.

## Fixed

- Replaced combined dnd5e weapon type labels such as `Martialm`, `Martialr`, `Simplem`, and `Simpler` with clear, independent class and range filters.
