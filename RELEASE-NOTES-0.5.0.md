# Morelord Marketplace 0.5.0

## Added

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

## Improvements

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

## Changed

- [Premium] Shop transactions no longer use the global Marketplace GM approval workflow. Shop rules, stock, pricing, and reputation provide the transaction constraints, so valid shop purchases and sales complete directly.
- [Premium] Random inventory rarity values define how many distinct products are selected, while each selected product receives its own stock quantity. Common items can stock 1-6, Uncommon 1-4, Rare 1-2, and Very Rare/Legendary 1.
- [Premium] Shop definitions are stored per world in `morelord-marketplace.shops`; export/import is the supported way to reuse configured shops across worlds.
- Foundry compatibility remains focused on Foundry VTT v14 and newer module APIs.

## Fixed

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
