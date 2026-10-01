---
title: Morelord Marketplace Documentation
slug: morelord-marketplace
product: morelord-marketplace
version: 0.10.1
---

# Morelord Marketplace Documentation

## Overview

Morelord Marketplace is a shopping, selling, and inventory-transfer system for Foundry Virtual Tabletop and the dnd5e game system. It gives players a searchable global item catalog, direct character purchases and sales, currency-free inventory transfers, automatic purchase and sale currency handling, and detailed filters for item type, category, weapon class, weapon range, weapon properties, weapon masteries, rarity, source, attunement, price, and affordability.

Game Masters control which Item compendiums supply the catalog, whether global buying and selling are enabled, the default sale value, transaction chat cards, and optional approval requirements. With Tools Premium or Tools Champion access, GMs can also build scene vendors with custom products, prices, reputation, limited or unlimited stock, randomized restocking, separate shopper and funding actors, portable shop definitions, and interactive shop tokens.

The global Marketplace provides a broad world catalog, while scene shops create individual vendors with their own inventory and trading rules. Purchased items are added directly to the chosen character, payment can come from an owned character or shared Group actor, and completed sales deposit currency automatically.

The global tabs run **Sell → Transfer → Buy → Wishlist**. Players choose a sending character or Group in **Shopping As**, add eligible physical items and quantities to the cart, select another character or Group as **Recipient**, and choose **Transfer Items**. A connected GM processes transfers automatically without approval or currency changes. Containers bring all contents and nested containers with their organization preserved; individual contents can also be sent separately. Sell eligible inventory items at rates set by the GM.

## See Marketplace in action

<p class="docs-video-intro">
	Take a guided tour of the Marketplace setup, catalog, and Game Master workflow.
</p>

<div class="docs-video">
	<iframe
		src="https://www.youtube-nocookie.com/embed/UeHIy5t6FGs"
		title="Morelord Marketplace demo"
		loading="lazy"
		allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
		allowfullscreen
	></iframe>
</div>

## Choose a manual

Choose the guide that matches your role:

- [Game Master Manual](gm-manual.md) — installation, world configuration, premium access, approvals, and Shop Manager.
- [Player Manual](player-manual.md) — selecting a character, browsing, buying, selling, transferring inventory, and using scene shops.

These manuals describe Morelord Marketplace 0.10.1 for Foundry Virtual Tabletop v14 and the dnd5e game system.


These manuals cover Marketplace 0.10.1 with Morelord Core 0.4.0 or later. Buy and Sell use carts; shops support shared Locations, capability limits, and weighted random stock.

Version 0.9.9 adds manual-only shop stock, exclusive vendor purchase lists, Magical-property exclusion, and rarity-based prices for unpriced source items. Blank rarity defaults to Common at 100 gp; explicit prices and GM overrides take priority. Requires Morelord Core 0.4.0 or later.

Version 0.10.0 adds inventory transfers to characters and Groups, quantity controls, matching transaction receipts, wider carts, and collapsible Buy filters. A connected GM is required for transfers. Requires Morelord Core 0.4.0 or later.

Version 0.10.1 corrects container transfers: all contents and nested containers move together with their organization preserved. Contents may also be transferred individually.
