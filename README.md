# Morelord Marketplace

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
  - Rarity
  - Source Book
  - Weapon Properties
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
- Allowed compendiums
- Shop pricing, reputation, inventory, stock, and restocking rules *(Shop Manager premium feature)*

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
- Morelord Core v0.1.0 or later
- dnd5e System compatible with Foundry v14

---

## Usage

### Players

Open the global Marketplace using the Marketplace button on the Token controls, or interact with a placed shop token to browse that vendor.

The global Marketplace can be used for buying, selling, or lookup depending on the GM's world settings. Shops use their own inventory, stock, pricing, reputation, and buy/sell rules.

---

### Game Masters

Use the global Marketplace for unrestricted catalog access, or open **Shop Manager** from the scene controls to create and manage premium scene vendors.

Configure available compendiums and global buy/sell behavior under:

```
Game Settings
→ Configure Settings
→ Module Settings
→ Morelord Marketplace
```

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

The global Marketplace remains available as the Standard catalog/lookup experience. GMs can independently disable global buying and global selling while leaving catalog browsing available to players. Shop Manager is premium and provides constrained scene vendors with stock, pricing, reputation, and restocking rules.

## Morelord Modules

- Morelord Marketplace
- Morelord Drakkenheim Harvesting
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

All Morelord Foundry modules use the same `release.ps1`. Project-specific values are stored in `release.config.json`, so improvements to the workflow can be copied between repositories without editing module logic.

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

Random inventory rarity counts control how many different product listings are selected during a restock. Each selected limited-stock product also receives a randomized quantity: Common 1–6, Uncommon 1–4, Rare 1–2, and Very Rare/Legendary 1. This is independent of the "Allow duplicate random items" option.
