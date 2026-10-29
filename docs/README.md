---
title: Morelord Marketplace Documentation
slug: morelord-marketplace
product: morelord-marketplace
version: 0.12.0
---

# Morelord Marketplace Documentation

## Overview

Morelord Marketplace is a shopping, selling, and inventory-transfer system for Foundry Virtual Tabletop and the dnd5e game system. It gives players a searchable global item catalog, direct character purchases and sales, currency-free inventory transfers, automatic purchase and sale currency handling, and detailed filters for item type, category, weapon class, weapon range, weapon properties, weapon masteries, rarity, source, attunement, price, and affordability.

Game Masters control which Item compendiums supply the catalog, whether global buying and selling are enabled, whether the current location must have a Marketplace, the default sale value, transaction chat cards, and optional approval requirements. With Tools Premium or Tools Champion access, GMs can also build scene vendors with custom products, prices, reputation, limited or unlimited stock, randomized restocking, separate shopper and funding actors, portable shop definitions, and interactive shop tokens.

The global Marketplace provides a broad world catalog, while scene shops create individual vendors with their own inventory and trading rules. Purchased items are added directly to the chosen character, payment can come from an owned character or shared Group actor, and completed sales deposit currency automatically.

The global tabs run **Sell → Transfer → Buy → Wishlist**. Players choose a character or party Group as **Sender**, add eligible physical items and quantities to the cart, select another character or Group as **Recipient**, and choose **Transfer Items**. Group membership is sufficient without Owner permission. A connected GM processes transfers automatically without approval or currency changes. Containers bring all contents and nested containers with their organization preserved; individual contents can also be sent separately. Sell eligible inventory items at rates set by the GM.

## See Marketplace in action

<p class="docs-video-intro">
	Take a guided tour of the Marketplace setup, catalog, and Game Master workflow.
</p>

<div class="docs-video">
	<iframe
		src="https://www.youtube-nocookie.com/embed/jLHKF39rGjM"
		title="Morelord Marketplace demo"
		loading="lazy"
		allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
		allowfullscreen
	></iframe>
</div>

<p class="docs-video-intro">
	Additional Game Master demo.
</p>

<div class="docs-video">
	<iframe
		src="https://www.youtube-nocookie.com/embed/UeHIy5t6FGs"
		title="Morelord Marketplace additional demo"
		loading="lazy"
		allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
		allowfullscreen
	></iframe>
</div>

## Choose a manual

The in-game Documentation button opens this home page on the Morelord Gaming website in a new browser tab through Core. The GM manual includes the complete Shop Manager and Game Settings field references; the player manual explains all shared Marketplace controls.

Choose the guide that matches your role:

- [Game Master Manual](gm-manual.md) — installation, world configuration, premium access, approvals, and Shop Manager.
- [Player Manual](player-manual.md) — selecting a character, browsing, buying, selling, transferring inventory, and using scene shops.

These manuals describe Morelord Marketplace 0.12.0 for Foundry Virtual Tabletop v14 and the dnd5e game system.


These manuals cover Marketplace 0.12.0 with Morelord Core 0.7.0 or later. Open **Morelord Tools** on the left side of the scene, then select **Morelord Marketplace**. GMs select **Manage Marketplace Shops** in that same control; it still requires Tools Premium or Tools Champion access. Buy and Sell use carts; shops support shared Locations, capability limits, and weighted random stock. **Enable Locations** can require the current location's Marketplace capability before anything is bought or sold. Buy then omits items above that tier. Sell still lists owned items above the tier and disables their sell buttons. A shop's own stock and purchase rules override the tier. Filled-container purchases include source compendium contents with separate container links for each copy. Placed shop tokens still open that vendor.

Version 0.9.9 adds manual-only shop stock, exclusive vendor purchase lists, Magical-property exclusion, and rarity-based prices for unpriced source items. Blank rarity defaults to Common at 100 gp; explicit prices and GM overrides take priority. Requires Morelord Core 0.4.0 or later.

Version 0.10.0 adds inventory transfers to characters and Groups, quantity controls, matching transaction receipts, wider carts, and collapsible Buy filters. A connected GM is required for transfers. Requires Morelord Core 0.4.0 or later.

Version 0.10.1 corrects container transfers: all contents and nested containers move together with their organization preserved. Contents may also be transferred individually.
