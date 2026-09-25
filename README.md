# Morelord Marketplace

Optional reporting: with a compatible Core and fresh GM consent, marketplace/shop opens and buy/sell service attempts, returns and failures are reported without account linking. Core owns privacy, transport and sanitized errors; see [Core telemetry](../morelord-core/TELEMETRY.md). Existing Core versions keep working without reporting. The website endpoint must be deployed before release.

A modern, immersive marketplace for **Foundry Virtual Tabletop** that allows characters to buy and sell items directly from their inventories using configurable compendiums, dynamic pricing, and an intuitive shopping experience.

---

## Features

### 🛒 Buy Items

- Purchase items directly from selected compendiums
- Supports any number of configured item compendiums
- Dynamic search and filtering
- Filter by:
  - Item Type
  - Category
  - Weapon Class
  - Weapon Range
  - Rarity
  - Source Book
  - Weapon Properties
  - Weapon Masteries
  - Attunement
  - Price Range
- Show only items the current character can afford
- Amazon-style sidebar filters
- Tri-state filters
  - □ Any
  - ☑ Include
  - ⊟ Exclude

---

### 💰 Sell Items

- Sell items directly from character inventory
- Sell one
- Sell all
- Configurable sell percentage
- Sort inventory by name, type, quantity, list price, or sell price
- Linked item names on transaction and approval chat cards
- Automatically deposits currency into the character sheet

---

### 👤 Actor and Funding Aware

The global Marketplace uses the active player character or selected token as appropriate. Shops provide explicit selectors when more control is needed:

- **Shopping As** determines which player character receives purchased items.
- **Paying From** determines which player character or Group actor supplies the currency.

This allows a character to receive an item while a shared party Group actor pays for it.

---

### 📖 Item Information

Every marketplace item includes:

- artwork
- rarity
- source book
- purchase price
- compendium link

Clicking an item opens the original compendium entry.

---

### 👑 Optional Premium Features

With an active **Morelord Tools Premium** or **Tools Champion** membership:

- Require GM approval for player purchases in the global Marketplace
- Require GM approval for player sales in the global Marketplace
- Use **Shop Manager** to create, configure, restock, place, import, and export scene vendors
- Manage access through the shared Morelord Core module
- Continue using cached access during temporary website outages

The global Marketplace remains Standard. Existing world data is never removed when premium access expires.

---

### ⚙️ Configurable

Game Masters can configure:

- Global Marketplace buying enabled/disabled
- Global Marketplace selling enabled/disabled
- Sell percentage
- Default global buy rate (minimum `1`; `1.5` charges 150% of list price)
- Catalog sources follow D&D5e Configure Sources
- Shop pricing, reputation, inventory, stock, and manual restocking *(Shop Manager premium feature)*

Shop definitions are stored in the Foundry world setting `morelord-marketplace.shops`. Shop Manager can export a shop to a portable JSON definition and import that definition into another world. Actor/token UUIDs are intentionally excluded from exported definitions and are recreated in the destination world.

---

## Installation

### Manifest URL

```
https://raw.githubusercontent.com/tmoreland72/morelord-marketplace/main/module.json
```

Install this URL using:

**Foundry → Add-on Modules → Install Module → Manifest URL**

---

## Requirements

- Foundry VTT v14
- Morelord Core 0.3.15 or later
- dnd5e System compatible with Foundry v14

---

## Usage

### Players

Open the global Marketplace using the Marketplace button on the Token controls, or interact with a placed shop token to browse that vendor.

The global Marketplace can be used for buying, selling, or lookup depending on the GM's world settings. Shops use their own inventory, stock, pricing, reputation, and buy/sell rules.

---

### Game Masters

Use the global Marketplace for unrestricted catalog access, or open **Shop Manager** from the scene controls to create and manage premium scene vendors.

Configure global buy/sell behavior under:

```
Game Settings
→ Configure Settings
→ Module Settings
→ Morelord Marketplace
```

Configure catalog compendiums under **D&D5e → Configure Sources**.

---

## Shop Manager

Shop Manager is a premium Marketplace feature for building reusable scene vendors without duplicating Marketplace item data. Shops use the same configured catalog as the global Buy tab, then apply vendor-specific filters and rules.

A shop can define:

- product types and rarities
- prefab inventories generated from the Shop Compendium when at least 8 listed products match enabled Player's Handbook, Dungeon Master's Guide, SRD 5.1, or SRD 5.2 item compendiums
- unlimited, limited, or hybrid inventory
- randomized stock and restocking rules
- buy and sell price modifiers
- party reputation pricing
- whether buying and/or selling is allowed
- separate shopper and funding actors

Limited-stock shops support shared cart reservations. Restocks and stock-changing purchases advance the shop revision; stale open shops must be refreshed before another purchase can complete. Refreshing also clears the local cart so the player is always working from current stock.

Shop definitions are world data stored in `morelord-marketplace.shops`. Use **Export Shop** and **Import Shop** to move configured shops between worlds. Exported definitions intentionally omit world-specific Actor and token UUIDs.

### Global Marketplace vs. Shops

The global Marketplace remains available as the Standard catalog/lookup experience. GMs can independently disable global buying and global selling while leaving catalog browsing available to players. Shop Manager is premium and provides constrained scene vendors with stock, pricing, reputation, and manual restocking.

### Marketplace pagination and transaction carts

The global Buy catalog is paginated at 50 results per page and uses lightweight compendium indexes whenever indexed pricing is available. Buy and Sell tabs both use carts, allowing quantities and multiple item types to be submitted together. When GM approval is enabled, the whole cart is represented by one approval request and is revalidated before funds or inventory change.

The cart implementation includes compensating rollback for partial inventory failures. Chat-card creation is intentionally non-fatal after a transaction commits, preventing a successful transaction from appearing failed or leaving a cart available for accidental resubmission.

Before publishing the next release, smoke-test these scenarios in Foundry:

- Browse a catalog with multiple pages, change filters, and confirm the page resets and result range remains correct.
- Add Buy items on different pages, adjust quantities, clear the cart, and complete a purchase.
- Add one and all quantities to the Sell cart, remove quantities, clear the cart, and complete a sale.
- As a player, submit multi-item Buy and Sell carts with GM approval enabled; approve and deny each request from a GM client.
- Before approval, change funds, prices, availability, or owned quantities and confirm revalidation rejects the stale cart without partial changes.
- Confirm scene-shop stock reservations, stale-shop refresh behavior, wishlists, and shopper/funding actor selection still work.
- Disable transaction chat cards and confirm completed carts still clear normally.

## Morelord Modules

- Morelord Marketplace
- Morelord Craftworks
- Morelord Character Export
- Morelord Character Manager *(in development)*

---

## Support

Questions, feature requests, and bug reports are welcome.

GitHub Issues:

https://github.com/tmoreland72/morelord-marketplace/issues

---

## License

MIT License

---

Created by **Morelord Gaming**
## Standard release workflow

Production Morelord Foundry modules use the same `release.ps1`. Character Export and Downtime follow these release steps. Project-specific values are stored in `release.config.json`, so improvements to the workflow can be copied between repositories without editing module logic.

Before a normal release, create `RELEASE-NOTES-x.y.z.md`. The same Markdown file is used for the GitHub Release and parsed into the public Morelord Gaming `/releases` feed. Recognized headings are `Added`, `Features`, `Improvements`, `Changed`, `Fixed`, `Breaking Changes`, and `Security`. Prefix a bullet with `[Premium]` or `[Champion]` when the change is tier-specific; otherwise it is treated as Standard.

Set the website publishing token once in your PowerShell environment:

```powershell
$env:RELEASE_PUBLISH_TOKEN = "<release publish token>"
```

Validate without changing Git, GitHub, or the website:

```powershell
.\release.ps1 -Version x.y.z -DryRun
```

Publish the normal release:

```powershell
.\release.ps1 -Version x.y.z
```

The normal workflow validates the repository, updates `module.json`, builds and verifies the Foundry ZIP, commits and tags the release, pushes it, creates the GitHub Release from the same release-notes file, and publishes the release to `https://morelordgaming.com/releases`. Draft and prerelease builds intentionally skip the public website feed.

If GitHub release creation succeeds but website publication fails, retry only the idempotent website step:

```powershell
.\release.ps1 -Version x.y.z -WebsiteOnly
```

Use `-SkipWebsitePublish` only when intentionally creating a normal GitHub/Foundry release that should not appear on the Morelord website.


### Limited-stock quantities

Random inventory rarity settings control how many items are selected during creation or restocking. Without duplicates, the configured count is the maximum number of distinct listings; a smaller eligible pool yields fewer. With duplicates enabled, repeated selections increase the same listing's stock. Set a rarity to zero to select none. Stock quantity is randomized separately from these selection counts.

### Release documentation check

Production releases require the `docs` directory in the archive. Before releasing, update the manuals and set `docs/README.md` frontmatter to the target version; the shared release script rejects a missing or mismatched documentation landing page. Review all manuals as part of each code change, including behavior and compatibility requirements.


Shopping As and Paying From use Core’s shared character eligibility: player-owned characters and character members of the primary party. Existing actor permissions, currency checks, and Group inventory choices still apply.


Marketplace Settings uses Core’s standard page footer so Save stays visible below the scrolling settings.


Settings use Morelord Core’s shared headers, sections, content cards, settings rows, and footer. Descriptions remain beside checkboxes at narrow widths.


The Morelord Account section above Trading shows account connection, membership, and GM approval access, with Connect/Manage Account and Refresh controls.

### Temporary global rates and shop defaults

The GM can enable **Temporarily ignore buy and sell rates (both ×1)** in the global Marketplace. Everyone then buys and sells there at list price until the GM switches it off. Configured rates and shop prices are preserved. Rate changes refresh open windows and clear global carts so totals can be reviewed again. This is a world toggle, so it remains active across reloads until disabled.

New template and prefab shops copy the buy and sell rates from Marketplace settings; the GM can edit each shop’s values. Existing shops retain their saved rates. Shop Manager uses Core’s standard header and keeps **Restock Now**; the Restocking editor section is removed without erasing saved restock metadata. Prefab names are deduplicated in the picker, preserving old IDs and saved shops. Configure Sources applies to copied SRD items as well as their containing packs.

## Release dependency

This release requires Morelord Core 0.3.15 or newer for the shared UI and service updates. Optional integrations remain optional.

## Manually configured shop items

**Player can sell** enables selling to the vendor. Under **Items the shop will buy**, use **Add Item** to search enabled Item compendiums. Once this list contains an item, it is exclusive: the Sell tab shows only matching owned items, and checkout checks the current list again. Removing the last entry restores the shop's normal Item Options filtering. This list is independent of inventory offered for sale.

Items match their compendium origin (including renamed copies). Items without a recorded origin match by name and item type; copies from a different compendium origin require their own entry. Usual supported-type, positive-price, unsellable-flag, and reputation restrictions still apply.

**Only sell manually added items** is off by default. Enable it to offer only manually added inventory in any inventory mode. **Restock Now** restores those listings to their configured quantities and never selects additional products. Adding a listing or adjusting its quantity sets that restock quantity; purchases reduce remaining stock without changing the target. Sold-out manual listings remain visible to the GM. Existing manual listings without a saved target use their remaining quantity, or one if sold out, on their first manual-only restock.

Turning off **Generate limited stock randomly** only stops random stock generation. It does not remove existing generated stock or restrict Unlimited/Hybrid catalogs to manually added items, and it does not replenish manual stock.

**Common** includes both mundane items (no rarity) and common magic items. It is not a mundane-only filter. Enable **Exclude magical items** under Products to reject the D&D5e Magical (`mgc`) property regardless of rarity. This also filters manually added and prefab listings, restock candidates, and checkout. The option defaults to off and does not alter the purchase list or player-selling rules. It depends on items having their Magical property correctly set.

The purchase list and Current Inventory use the same Core section headings, count badges, Add Item actions, and item rows. Both show item artwork, a document link, available source details, and removal controls; inventory also has stock quantity controls.

### Unpriced items

Items with no positive source price use their known rarity's standard base value: Common 100 gp, Uncommon 400 gp, Rare 4,000 gp, Very Rare 40,000 gp, and Legendary 200,000 gp ([2024 SRD rarity table](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf)). Marketplace uses the full rarity value as its fallback, including consumables. Blank or mundane rarity uses Common (100 gp), including Grenade, Fragmentation. Explicit positive source prices and GM custom prices take priority. Artifacts and unknown rarities require an explicit price. Global/shop rates then apply consistently to browsing, purchases, approvals, and sales. Source and purchase restrictions still apply; source documents are not modified.

Regression: in Dev1, import `rarityPricingCheck` and `fragmentationGrenadeCheck` from `modules/morelord-marketplace/scripts/testing/rarity-pricing.mjs` and pass it to Core's `runInGameTests({ checks: [rarityPricingCheck, fragmentationGrenadeCheck] })`. It checks actual configured-source index entries against the catalog and full-document transaction pricing without buying or changing world data.

Catalogs and purchase validation accept only supported physical item types (weapons, equipment, consumables, tools, loot, and containers); price fallback does not turn spells or character features into products.
