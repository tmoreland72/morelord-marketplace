# Morelord Marketplace Changelog

## 0.12.0

### Added

- **Enable Locations** is a world setting, off by default. When it is on, buying and selling require the current location to have a Marketplace capability. Buy omits items above that tier from the catalog, item count, rarity counts, and pages. Sell still lists owned items above the tier and disables their sell buttons; the tooltip explains the limit.
- The current location is Morelord Core's location for the scene the shopper is viewing. An active Downtime session uses that session's location instead, including On the Road when the session has no location.
- A shop's own stock and purchase rules override the location rarity. A shop can still buy and sell a rarer item it stocks when the location Marketplace is a lower tier. No Marketplace at the location blocks shop trading as well.
- Blocked purchases and sales show a warning. The same check runs again when a Game Master client completes a cart, shop checkout, or approval, using the shopper's viewed scene.

## 0.11.1

### Improvements

- Marketplace now follows the D&D system's **Configure Sources** setting for every compendium it touches. A compendium you turned off there is not browsed, searched, purchased, previewed, approved, or opened from an item link, and it is never used as a fallback. Shop filters only narrow that list.
- Buying, checkout and GM approval all load the item through the same check. A copy of an SRD item in an enabled world compendium can no longer be bought while the SRD compendium is turned off.
- Prefab shops draw only from compendiums Configure Sources allows.
- Opening an item link from a compendium that is turned off shows "That compendium is not allowed" instead of the item.
- A shop's saved buy list entry that points at a turned-off compendium is ignored, and Shop Manager no longer lists it. The saved shop data is left in place, so turning the compendium back on brings the entry back.
- The setup help now points to **D&D5e → Configure Sources** instead of a separate Marketplace source list.

## 0.11.0

### Improvements

- Morelord Marketplace and Manage Marketplace Shops open from Morelord Tools. Marketplace stays available to every user. Manage Marketplace Shops stays GM-only: it refreshes entitlements, warns unless the account has Marketplace Premium or Champion access, and then opens Shop Manager.
- Requires Morelord Core 0.6.0 or newer. An older Core keeps both buttons on the Token controls. The shop-token HUD button is unchanged.

## 0.10.3

### Fixed

- Buying filled containers such as Explorer's Pack now includes their source compendium contents. Direct purchases, carts, shop checkout, and GM approvals preserve nested container links, with separate contents for each purchased copy.

## 0.10.2

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

## 0.10.1

### Fixed

- Transferring a container now brings all its contents, including nested containers, and preserves their organization in the recipient's inventory. Emptying containers first is no longer required.
- Items selected both individually and through a container move only once. Cart totals include contained quantities, and the transaction receipt lists every item moved.
- Transfers recheck container contents before changing the sender's inventory. Recovery restores containment after a failed transfer; items can still be sent independently from inside containers.

## 0.10.0

### Added

- Transfer items, selected quantities, or entire stacks from your inventory to another player character or Group using the new Transfer tab and Shopping Cart. A connected GM is required; transfers complete automatically without approval or currency changes.

### Improvements

- Marketplace tabs now follow Sell → Transfer → Buy → Wishlist and support keyboard navigation.
- Transfer uses familiar inventory rows, plus/minus cart quantity controls, and a recipient selector with the actor portrait inside it.
- Buy, Sell, and Transfer carts use 30% of the desktop layout. Buy filters collapse and remember their state; Source labels use a fixed width with ellipsis and full-name tooltips.
- Transfer chat receipts match Marketplace's existing transaction cards, showing linked sender, recipient, items, quantities, and the item total.

## 0.9.9

### Improvements

- [Premium] Shop Manager supports an exclusive list of items players can sell to a shop, checked both in the Sell tab and at checkout.
- [Premium] Shops can offer only manually added products; restocking restores their configured quantities without introducing random items.
- [Premium] Exclude magical items filters the Magical property across listings, restock candidates, and checkout, independently of rarity.
- [Premium] Purchase lists and inventory share Core section actions and item-row presentation.

### Fixed

- Configured-source items without a positive price now use standard rarity base values. Blank or mundane rarity uses Common at 100 gp, restoring items such as Grenade, Fragmentation to the catalog. Explicit prices and GM overrides take priority; normal buy/sell rates still apply.

- Buy catalogs and checkout enforce supported physical item types, excluding spells and character features even when rarity pricing is available.

## 0.9.8

### Improvements

- Added optional marketplace/shop and buy/sell instrumentation through Core, requiring fresh GM consent.
- Requires Core 0.3.9 for the shared source-filter service.
- Shop deletion and inventory removal now use standard Core buttons instead of red buttons.
- Clarified random-inventory help to describe the editable rarity selection counts without mixing in fixed stock-quantity ranges.
- Added a GM global-marketplace toggle for temporary ×1 buy/sell rates. New shops inherit configured rates and remain editable; existing shop prices are preserved.
- Catalogs, prefab matching, and restocks honor excluded SRD provenance, including copied items in other packs. Prefab choices are unique by normalized name; saved IDs remain valid.
- Shop Manager uses the standard Core page header, explains rarity draws versus stock quantities, and removes the Restocking editor section while retaining Restock Now and saved restock metadata.

## 0.9.7

### Improvements

- Fixed v6 rare Items being classified as Common/nonmagical in catalogs and shop validation. Supports both rarity index fields and legacy data through Core 0.3.8.
- Verified Foundry compatibility is explicitly recorded as 14.367; existing Foundry and system support minimums remain unchanged.
- Release guidelines require checking the latest stable Foundry build and confirming the published Foundry listing.

## 0.9.6

### Improvements

- Account connection, membership, and refresh controls appear in a separate Morelord Account section above Trading.

- Settings use Core headers, section headings, cards, responsive settings rows, badges, and footers; duplicated local settings styling has been removed.

- Marketplace Settings uses Core’s standard page footer so Save stays visible below the scrolling settings.

- Shopping As and Paying From use Core’s shared character eligibility: player-owned characters and character members of the primary party. Existing actor permissions, currency checks, and Group inventory choices still apply.

- Added Default Buy Rate for global purchases, defaulting to 1 and requiring a value of 1 or higher. Shop pricing remains independent.
- Added clear headers above the buy and sell rate inputs using Core shared stacked fields.

### Changed

- Require Morelord Core 0.3.7 or later for the shared components and character eligibility used by this release.

## 0.9.5

### Improvements

- Use Core page and keyed-panel scroll preservation in Marketplace and Shop Manager.
- Show Core actor portraits in shopper and payer selectors while retaining stored actor IDs.
- Require packaged product documentation and validate its landing-page version.

### Fixed

- Correct manual versions, Core requirements, Buy/Sell cart instructions, and shop capability and wishlist guidance.
- Use Foundry's native HTML escaping utility and synchronize the release script with Core.
- Allow actor selectors to shrink within their shared portrait layout.

### Changed

- Require Morelord Core 0.3.6 or later for the shared UI services used by this release.

## 0.9.4

### Improvements

- Place shopper and payer controls in their own section below the header.
- Use shared Core sections for Buy, Sell, Wishlist, and loading states, with shared navigation controls and theme colors.
- Mark manually added stock with a Manual pin badge explaining that restocking preserves its remaining quantity.
- Use shared configuration surfaces, Settings action footers, and page-scroll preservation.
- Require Morelord Core 0.3.5 for the shared source and layout updates.

### Fixes

- Replace guaranteed wishlist picks with a modest 1.25x selection weight. Eligible wishlist items can now be missed during a restock, with or without duplicates enabled.
- Resolve catalog source names through Core with the full source and owning pack metadata.
- Correct conflicting Sell-cart sizing and oversized stacked shopper selectors.
- Scope previously unscoped button styles to Marketplace.

## 0.9.3

### Added

- Added shared Location selection and an optional maximum normal rarity to shop configuration, while allowing manually included inventory above that limit.
- Added a GM shortcut to the Core Location Manager.
- Exposed shop capabilities, magic-item wishlists, random item selection, and sourcing investment operations through the module API.

### Improvements

- Used Core's shared source-book label resolver for catalog sources.
- Updated the example publishing configuration for website and Foundry release tokens.

## 0.9.2

Morelord Marketplace 0.9.2 improves checkout reliability and makes the most useful catalog filters easier to reach.

### Added

- Moved rarity and attunement filters near the top of the Buy filter panel.

### Fixed

- Ensured completed purchases refresh checkout state even when confirmation UI fails.
- Avoided duplicate transaction cards for global marketplace purchases.
- Improved cart approval and completed transaction card markup under the shared Core design system.
- Removed misleading item artwork from multi-item cart approval cards.

## 0.9.1

This critical patch restores Standard catalog sources and corrects Marketplace actor selection.

### Fixed

- Restored enabled D&D5e system Item compendiums, including the Standard SRD 5.1 and SRD 5.2 sources, to the global Buy catalog.
- Correctly labels D&D5e SRD 5.2 packs from their source-book metadata instead of grouping them under SRD 5.1.
- Allows GMs without an assigned character or controlled token to select any eligible Character actor for Paying As, defaulting to the selected shopper when possible.

## 0.9.0

This release improves Marketplace browsing performance, streamlines source configuration, and polishes the shopping and Shop Manager interfaces.

### Changes

- Added a paginated Buy catalog with full-width previous, status, and next controls.
- Improved Buy catalog startup by sharing in-flight index/catalog work, prewarming the catalog, processing indexes concurrently, and keeping browsing index-only.
- Reduced per-page work by decorating only visible Buy rows.
- Added separate List Price and Selling Price columns while removing Type and Category columns from Marketplace tables.
- Reordered Buy filters and aligned wishlist/cart actions horizontally.
- Updated Shopping As and Paying As defaults to prefer the user's character, active character, then an eligible Group actor.
- Positioned the Sell cart beside inventory and enlarged existing-store cards in Shop Manager.
- Simplified Marketplace Settings and made D&D5e Configure Sources the single source of truth for catalogs, checkout validation, approvals, and prefab shops.
- Standardized Settings scrolling so the window owns the scrollbar instead of its content list.

## 0.8.0

Morelord Marketplace 0.8.0 adds wishlists and adopts the shared Morelord product interface.

### Added

- Added a persistent wishlist workflow and dedicated Wishlist tab.
- Added shared Morelord application, hero, card, settings, empty-state, status, action, and chat-card components.

### Improved

- Moved all user-facing settings into the Marketplace Configure application.
- Reworked Manage Shops layout, inventory controls, responsive sizing, scrolling, and content-sized template cards.
- Split the manifest stylesheet into maintainable catalog and shops feature styles.
- Standardized readable `ml-marketplace-*` selectors and data attributes.
- Standardized transaction, approval, shop, cart, and catalog presentation with Core typography and semantic colors.

### Fixed

- Fixed stale dataset bindings after namespace migration.
- Fixed wrapped shop-template labels escaping their buttons.

## 0.7.0

### Added

- Added live shop inventory management to Manage Shops, including compendium item search, persistent manual additions and removals, and quantity steppers for limited stock.
- Added unsaved shop previews so store templates and prefab stores are not created until the GM selects Create Shop.

### Improved

- Reorganized shop inventory, restocking, product, and current-inventory settings for faster GM access.
- Kept shop actions visible while the settings panel scrolls and preserved list positions across interface rerenders.
- Replaced submit-style inventory search with fast, debounced search that retains keyboard focus.
- Increased the default size of Marketplace windows and widened vendor windows for the item list and cart.
- Standardized item source labels as publication names, with Craftworks used for Morelord Craftworks content.

### Fixed

- Prevented unsupported scheduled restocking choices from appearing.
- Prevented generic compendium labels such as Items or Equipment from appearing as item sources.
- Prevented inventory changes and other list actions from resetting scroll positions.
- Preserved GM inventory overrides when a shop is restocked.

## 0.6.1

### Added

- Added character and group actor selectors for shopping and payment in both the global Marketplace and vendor shops.
- Added quantity steppers to shop inventory rows and shopping-cart entries.

### Improved

- Redesigned shopping-cart item cards with clearer pricing and compact quantity controls.
- Kept Marketplace filter, result, and cart scroll positions stable while the interface rerenders.
- Aligned shop configuration checkbox labels consistently beside their controls.

### Fixed

- Fixed selling from owned character and group inventories through the global Marketplace and vendor shops.
- Fixed stale shop inventory remaining visible after restocking.
- Added explicit cross-client inventory refresh notifications after a GM restocks a shop.
- Fixed shop checkout incorrectly rejecting products that were visibly available in the shop catalog.
- Made manual restocking save the currently displayed shop configuration before generating inventory.

## 0.6.0

Morelord Marketplace 0.6.0 improves catalog filtering, inventory browsing, and transaction chat cards across the global Marketplace and scene shops.

### Added

- Added separate **Weapon Class** filters for Martial and Simple weapons.
- Added separate **Weapon Range** filters for Melee and Ranged weapons.
- Added **Weapon Masteries** filters whenever weapons are in scope and mastery data is available.
- Added a **Sort by** control to global and shop Sell tabs with Name, Type, Quantity, List Price, and Sell Price options.

### Improved

- Sell inventory defaults to alphabetical Name sorting and uses Name to break ties for all other sort choices.
- Buy filter sidebars preserve their scroll position when a filter change rerenders the Marketplace.
- Weapon-specific facet counts are calculated only from weapon entries, while general category filters remain focused on non-weapon item categories.
- Item names on completed transactions and every approval-card state are now Foundry document links when a UUID is available.
- Sale chat cards prefer an item's original compendium source link so the link can survive selling the final owned copy.

### Fixed

- Replaced combined dnd5e weapon type labels such as `Martialm`, `Martialr`, `Simplem`, and `Simpler` with clear, independent class and range filters.

## 0.5.2

Morelord Marketplace 0.5.2 adds more precise product controls for managed shops and improves the prefab shop list layout.

### Added

- Shop product filters can now distinguish armor, other equipment, potions, spell scrolls, other consumables, artisan tools, and other tools.
- Existing shops automatically map their legacy item-type selections to the new product options.

### Improved

- Buying, selling, random inventory, and compendium matching now use the same detailed product filters.
- Prefab shop cards have more consistent spacing and sizing in the Shop Manager.

## 0.5.1

Morelord Marketplace 0.5.1 ensures the Standard global Marketplace remains fully transactional without account authentication.

### Fixed

- Saved premium GM-approval settings no longer intercept Standard purchases or sales when Marketplace premium access is unavailable.
- Standard buying and selling now complete directly without requiring a connected Morelord account.

### Notes

- GM transaction approvals and Shop Manager remain premium features.
- Existing approval preferences are preserved and become active again when premium access returns.

## 0.5.0

### Added

- [Premium] Added **Shop Manager**, a scene-based vendor system built on top of the Morelord Marketplace catalog and transaction engine.
- [Premium] Added reusable shop templates for General Store, Weaponsmith, Armorer, Apothecary, Magic Shop, Temple / Healer, Arcane Supplier, Adventuring Gear, Tavern / Provisioner, Exotic Goods, and Custom vendors.
- [Premium] Added scene shop Actors and tokens. Interacting with a shop token opens that vendor directly in Marketplace.
- [Premium] Added shop-specific product filters, rarity limits, buy and sell pricing, reputation tiers, inventory modes, stock rules, and restocking configuration.
- [Premium] Added Unlimited, Limited Stock, and Hybrid shop inventory modes.
- [Premium] Added randomized limited inventory with independent product-count and quantity generation by rarity.
- [Premium] Added shopping carts with quantity tracking, affordability checks, stock reservations, purchase totals, and remaining-funds previews.
- [Premium] Added separate **Shopping As** and **Paying From** selectors so purchased items can go to one character while currency is deducted from another character or Group actor.
- [Premium] Added shop-specific selling. Shops can determine what item types they buy and apply reputation-adjusted sell pricing.
- [Premium] Added shared limited-stock reservations so items placed in carts are reflected across GM and player clients before checkout.
- [Premium] Added shop revision tracking and **Refresh** controls. Restocks and stock-changing transactions invalidate stale shop views and require a refresh before checkout.
- [Premium] Added portable shop **Export** and **Import** using JSON definitions that can be moved between Foundry worlds.
- [Premium] Added configurable shop images using Foundry's native file browser and synchronized shop names/images across backing Actors, prototype tokens, and placed tokens.
- [Premium] Added consolidated purchase chat cards: one card per shopping cart, including shop name, purchased items, quantities, total cost, and funding source when different from the shopper.
- Added game settings to independently disable buying and selling in the **global Marketplace**, allowing the catalog to remain available as a player lookup/reference tool.

### Improvements

- [Premium] Shop Manager now presents current-world shops as image cards with shop type and compact status indicators.
- [Premium] Shop windows use the configured shop image in the vendor header.
- [Premium] Shop browsing uses lightweight compendium indexes and cached catalog data, deferring full document loading until needed for a transaction.
- [Premium] Shop catalogs warm index data in the background to reduce first-open delays for GM and remote players.
- [Premium] Shop checkout is GM-authoritative for player transactions, allowing stock, currency, and item delivery to be validated and completed safely without requiring manual GM approval.
- [Premium] Limited stock shown in the catalog accounts for items reserved in active shopping carts; reserved quantities are marked with an asterisk.
- [Premium] Successful checkout automatically clears the shopping cart.
- [Premium] Shop sell prices now have a minimum of 1 cp for items with a positive value.
- [Premium] Cart item names and images are interactive, and purchase chat links target the item copy created on the purchasing Actor when available.
- [Premium] GM shopper selectors now focus on player characters, while funding selectors include player characters and Group actors.
- [Premium] Shop item tables were streamlined to prioritize Item, Rarity, Price, Stock, and purchase controls.
- [Premium] Added loading/working states when creating and opening shops to prevent duplicate actions while catalogs are being prepared.
- [Premium] Deleting a shop also removes placed tokens associated with that shop.
- [Premium] Shop Manager registration no longer depends on entitlement refresh timing; access is checked when the GM opens the feature.

### Changed

- [Premium] Shop transactions no longer use the global Marketplace GM approval workflow. Shop rules, stock, pricing, and reputation provide the transaction constraints, so valid shop purchases and sales complete directly.
- [Premium] Random inventory rarity values define how many distinct products are selected, while each selected product receives its own stock quantity. Common items can stock 1-6, Uncommon 1-4, Rare 1-2, and Very Rare/Legendary 1.
- [Premium] Shop definitions are stored per world in `morelord-marketplace.shops`; export/import is the supported way to reuse configured shops across worlds.
- Foundry compatibility remains focused on Foundry VTT v14 and newer module APIs.

### Fixed

- [Premium] Fixed intermittent shop-token interactions that could open or briefly flash the normal Actor sheet instead of Marketplace.
- [Premium] Fixed player shop windows sometimes failing to open or appearing only after a long asynchronous delay.
- [Premium] Fixed shop catalogs appearing empty even when matching products were available in the global Buy catalog.
- [Premium] Fixed shop filtering against incomplete raw compendium index data instead of normalized Marketplace product data.
- [Premium] Fixed stale shop catalog cache keys after product-filter changes.
- [Premium] Fixed player checkout being able to deduct currency before stock updates failed due to world-setting permissions.
- [Premium] Fixed player checkout socket requests timing out because the module socket channel was not declared in the manifest.
- [Premium] Fixed pending/limited stock not being visible to other connected clients while an item was reserved in a cart.
- [Premium] Fixed purchased-item chat links that could point to source compendium documents the player did not have permission to open.
- [Premium] Fixed shop creation and checkout clearing compendium index caches and forcing unnecessary catalog rebuilds.
- [Premium] Fixed limited random stock effectively assigning quantity 1 to every item when duplicate random items were disabled.
- [Premium] Removed use of the deprecated global Foundry `Token` class in favor of the v14 namespaced API.

## 0.4.0

### New Features

- Added support for the Morelord Marketplace `purchasable` item flag.
- Items can now explicitly opt out of appearing in the Marketplace Buy catalog.
- Added compatibility with Morelord Craftworks purchasing rules.

### Purchasing Rules

- Items with no `purchasable` flag continue to use normal Marketplace behavior.
- Items with `purchasable: true` remain available for purchase when they have a valid price.
- Items with `purchasable: false` are excluded from the Buy catalog even when they have a monetary value.
- The `purchasable` flag affects buying only; flagged items may still be sold when they have a valid value.

### Reliability

- Purchasable status is checked while building the Buy catalog.
- Purchasable status is revalidated when a purchase is made.
- GM-approved purchases revalidate purchasable status before completing the transaction.
- Prevents stale Marketplace data from bypassing purchasing restrictions.

## 0.3.2

### Fixed

- Added the Morelord Core manifest URL to the required-module relationship.
- Foundry can now locate and offer to install Morelord Core automatically when Marketplace is installed and Core is missing.

## 0.3.1

### Interface refinement

- Condensed the Premium badge shown beside locked GM approval settings.
- Changed the oversized Manage account control into a compact inline Account button.
- Kept the account action on the same line as the premium-access message when space allows.
- Added explicit size overrides so Foundry theme button and label styles do not expand these controls.

## 0.3.0

### Premium access integration

- Added Morelord Core as a required shared account and entitlement dependency.
- GM approval for purchases and sales now requires the `marketplace.gm-approvals` product feature.
- Standard users retain all normal buying and selling functionality.
- Premium settings remain visible but are locked when access is unavailable.
- Added account connection, access status, and manual refresh controls to Marketplace configuration.
- Uses Morelord Core's cached entitlement grace period during temporary website outages.
- Existing settings and transaction data are never deleted when premium access expires.

### API

The Marketplace API now exposes:

```js
game.modules.get("morelord-marketplace")?.api.hasPremiumApprovals();
await game.modules.get("morelord-marketplace")?.api.refreshEntitlements();
```
