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

### 👤 Character Aware

Marketplace automatically opens for:

- the logged-in player's assigned character

or

- the currently selected token (GM)

allowing the GM to quickly shop as any character.

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

- Require GM approval for player purchases
- Require GM approval for player sales
- Manage access through the shared Morelord Core module
- Continue using cached access during temporary website outages

Standard buying and selling remain free. Existing world data is never removed when premium access expires.

---

### ⚙️ Configurable

Game Masters can configure:

- Buying enabled
- Selling enabled
- Sell percentage
- Allowed compendiums
- Shop pricing modifiers *(future)*
- Shop inventories *(future)*

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

Open the Marketplace using the Marketplace button on the Token controls.

Browse available items, filter the catalog, and purchase equipment using your character's currency.

Switch to the Sell tab to sell unwanted items.

---

### Game Masters

Select any player token before opening the Marketplace to shop as that character.

Configure available compendiums under:

```
Game Settings
→ Configure Settings
→ Module Settings
→ Morelord Marketplace
```

---

## Considering Features

- Shopkeepers
- Multiple shops
- Regional inventories
- Reputation discounts
- Faction pricing
- Limited stock
- Restocking
- Random inventory generation
- Shopping carts
- Crafting integration
- Item Piles integration
- Roll Tables for shop generation
- Currency exchange
- Merchant portraits
- Buyback inventory
- Black markets
- Magic item vendors
- Price history
- Shopping journal integration

---

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
$env:MORELORD_RELEASE_TOKEN = "<release publish token>"
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

