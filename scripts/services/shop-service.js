import { MODULE_ID, FLAGS } from "../constants.js";
import { SHOP_TYPES, REPUTATION_TIERS, ShopProfileModel } from "../models/shop-profile.js";
import { PrefabShopService } from "./prefab-shop-service.js";

export class ShopService {
  static normalizeShop(shop) {
    if (!shop) return null;
    return {
      ...shop,
      revision: Math.max(1, Number(shop.revision ?? 1)),
      stock: { ...(shop.stock ?? {}) },
      prefabItemUuids: [...(shop.prefabItemUuids ?? [])],
      tokenUuids: [...(shop.tokenUuids ?? [])]
    };
  }

  static getShops() {
    return (game.settings.get(MODULE_ID, "shops") ?? []).map(shop => this.normalizeShop(shop));
  }

  static getShop(shopId) {
    return this.getShops().find(shop => shop.id === shopId) ?? null;
  }

  static getShopForActor(actor) {
    const shopId = actor?.getFlag?.(MODULE_ID, FLAGS.SHOP_ID);
    return shopId ? this.getShop(shopId) : null;
  }

  static getShopForToken(token) {
    return this.getShopForActor(token?.actor ?? token?.document?.actor);
  }

  static async ensureShopActorAccess(actor) {
    if (!game.user.isGM || !actor || !this.getShopForActor(actor)) return actor;
    const observer = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
    const currentDefault = Number(actor.ownership?.default ?? 0);
    if (currentDefault < observer) await actor.update({ "ownership.default": observer });
    return actor;
  }

  static async ensureAllShopActorAccess() {
    if (!game.user.isGM) return;
    for (const shop of this.getShops()) {
      if (!shop.actorUuid) continue;
      const actor = await fromUuid(shop.actorUuid).catch(() => null);
      if (actor) await this.ensureShopActorAccess(actor);
    }
  }

  static getPresets() {
    return Object.entries(SHOP_TYPES).map(([key, value]) => ({ key, ...value }));
  }

  static getReputationTiers() {
    return REPUTATION_TIERS.map(tier => ({ ...tier }));
  }

  static getReputationTier(shop) {
    return REPUTATION_TIERS.find(tier => tier.key === shop?.reputation) ?? REPUTATION_TIERS[2];
  }

  static bumpRevision(shop) {
    shop.revision = Math.max(1, Number(shop.revision ?? 1)) + 1;
    return shop.revision;
  }

  static async saveShop(shop, { bumpRevision = false } = {}) {
    const shops = this.getShops();
    const index = shops.findIndex(entry => entry.id === shop.id);
    const next = this.normalizeShop(foundry.utils.deepClone(shop));
    if (bumpRevision) this.bumpRevision(next);
    if (index >= 0) shops[index] = next;
    else shops.push(next);
    await game.settings.set(MODULE_ID, "shops", shops);
    return next;
  }

  static async createShop({ name, type = "general" } = {}) {
    const shop = ShopProfileModel.create({ name, type });
    return this.saveShop(shop);
  }


  static async getPrefabStores() {
    return PrefabShopService.getAvailablePrefabs({ minimumMatches: 8 });
  }

  static async createPrefabShop(prefabId) {
    const prefab = await PrefabShopService.getPrefab(prefabId);
    if (!prefab || prefab.matchedCount < 8) {
      throw new Error("That prefab shop no longer has enough matching Marketplace items.");
    }

    const shop = ShopProfileModel.create({
      name: prefab.name,
      type: "custom"
    });

    shop.prefabId = prefab.id;
    shop.prefabSource = {
      name: prefab.source,
      page: prefab.page,
      shopkeeper: prefab.shopkeeper
    };
    shop.prefabItemUuids = prefab.matches.map(match => match.uuid);
    shop.compendiums = [...new Set(prefab.matches.map(match => match.packId))];
    shop.itemTypes = [];
    shop.rarities = [];
    shop.inventoryMode = "unlimited";
    shop.randomInventory = {
      ...(shop.randomInventory ?? {}),
      enabled: false
    };
    shop.restock = {
      ...(shop.restock ?? {}),
      rule: "never"
    };

    return this.saveShop(shop);
  }

  static getPortableDefinition(shop) {
    if (!shop) return null;
    const portable = foundry.utils.deepClone(this.normalizeShop(shop));
    delete portable.id;
    delete portable.actorUuid;
    delete portable.tokenUuids;
    portable.revision = 1;
    return {
      format: "morelord-marketplace-shop",
      version: 1,
      exportedAt: new Date().toISOString(),
      shop: portable
    };
  }

  static async importPortableDefinition(data) {
    const payload = data?.format === "morelord-marketplace-shop" ? data.shop : data?.shop ?? data;
    if (!payload || typeof payload !== "object") throw new Error("This file does not contain a Marketplace shop definition.");

    const base = ShopProfileModel.create({
      name: String(payload.name ?? "Imported Shop"),
      type: SHOP_TYPES[payload.type] ? payload.type : "custom"
    });
    const shop = this.normalizeShop(foundry.utils.mergeObject(base, foundry.utils.deepClone(payload), {
      inplace: false,
      insertKeys: true,
      insertValues: true,
      overwrite: true
    }));
    shop.id = foundry.utils.randomID();
    shop.actorUuid = null;
    shop.tokenUuids = [];
    shop.revision = 1;
    return this.saveShop(shop);
  }

  static async syncShopIdentity(shop) {
    if (!game.user.isGM || !shop) return;
    const actor = shop.actorUuid ? await fromUuid(shop.actorUuid).catch(() => null) : null;
    if (actor) {
      await actor.update({
        name: shop.name,
        img: shop.img,
        "prototypeToken.name": shop.name,
        "prototypeToken.texture.src": shop.img
      });
    }

    const actorId = actor?.id ?? null;
    for (const scene of game.scenes ?? []) {
      const updates = [];
      for (const token of scene.tokens ?? []) {
        if (actorId && token.actorId === actorId) updates.push({ _id: token.id, name: shop.name, "texture.src": shop.img });
      }
      if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
    }
  }

  static async deleteShop(shopId) {
    const shop = this.getShop(shopId);
    if (!shop) return;
    const actor = shop.actorUuid ? await fromUuid(shop.actorUuid).catch(() => null) : null;
    const actorId = actor?.id ?? null;

    const trackedTokenIdsByScene = new Map();
    for (const uuid of shop.tokenUuids ?? []) {
      const token = await fromUuid(uuid).catch(() => null);
      const scene = token?.parent;
      if (!token?.id || !scene?.id) continue;
      const ids = trackedTokenIdsByScene.get(scene.id) ?? new Set();
      ids.add(token.id);
      trackedTokenIdsByScene.set(scene.id, ids);
    }

    for (const scene of game.scenes ?? []) {
      const tokenIds = new Set(trackedTokenIdsByScene.get(scene.id) ?? []);
      for (const token of scene.tokens ?? []) {
        if (actorId && token.actorId === actorId) tokenIds.add(token.id);
      }
      if (tokenIds.size) await scene.deleteEmbeddedDocuments("Token", [...tokenIds]);
    }

    if (actor) await actor.delete();
    const shops = this.getShops().filter(entry => entry.id !== shopId);
    await game.settings.set(MODULE_ID, "shops", shops);
  }

  static async ensureShopActor(shop) {
    if (shop.actorUuid) {
      const existing = await fromUuid(shop.actorUuid).catch(() => null);
      if (existing) {
        await this.ensureShopActorAccess(existing);
        return existing;
      }
    }

    const actorType = CONFIG.Actor?.typeLabels?.npc ? "npc" : (game.system.model?.Actor?.npc ? "npc" : Object.keys(game.system.model?.Actor ?? {})[0]);
    const actor = await Actor.create({
      name: shop.name,
      type: actorType,
      img: shop.img,
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2 },
      prototypeToken: {
        name: shop.name,
        texture: { src: shop.img },
        actorLink: true,
        disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        displayName: CONST.TOKEN_DISPLAY_MODES.HOVER
      },
      flags: { [MODULE_ID]: { [FLAGS.SHOP_ID]: shop.id, isShop: true } }
    });

    shop.actorUuid = actor.uuid;
    await this.saveShop(shop);
    await this.ensureShopActorAccess(actor);
    return actor;
  }

  static async placeShopOnScene(shopId, scene = canvas?.scene) {
    if (!game.user.isGM || !scene) return null;
    const shop = this.getShop(shopId);
    if (!shop) return null;

    const actor = await this.ensureShopActor(shop);
    const tokenData = actor.getTokenDocument
      ? await actor.getTokenDocument({
          x: Math.max(0, Math.round((scene.dimensions?.width ?? 1000) / 2)),
          y: Math.max(0, Math.round((scene.dimensions?.height ?? 1000) / 2))
        })
      : new TokenDocument(actor.prototypeToken.toObject(), { parent: scene });

    const created = await scene.createEmbeddedDocuments("Token", [tokenData.toObject ? tokenData.toObject() : tokenData]);
    const token = created?.[0];
    if (token?.uuid && !shop.tokenUuids?.includes(token.uuid)) {
      shop.tokenUuids = [...(shop.tokenUuids ?? []), token.uuid];
      await this.saveShop(shop);
    }
    return token;
  }

  static entryPassesShop(entry, shop, packId) {
    if (!shop) return true;

    if (shop.prefabItemUuids?.length) {
      const documentId = entry?.documentId ?? entry?._id;
      const uuid = entry?.uuid ?? (
        packId && documentId
          ? `Compendium.${packId}.Item.${documentId}`
          : ""
      );
      return Boolean(uuid && shop.prefabItemUuids.includes(uuid));
    }

    if (shop.compendiums?.length && !shop.compendiums.includes(packId)) return false;
    const type = String(entry?.typeKey ?? entry?.type ?? "").toLowerCase();
    if (shop.itemTypes?.length && !shop.itemTypes.map(value => String(value).toLowerCase()).includes(type)) return false;
    const rarity = this.normalizeRarity(entry?.rarityKey ?? entry?.system?.rarity);
    if (shop.rarities?.length && !shop.rarities.map(value => this.normalizeRarity(value)).includes(rarity)) return false;
    return true;
  }

  static normalizeRarity(value) {
    const raw = typeof value === "object" ? (value?.value ?? value?.id ?? value?.key ?? "") : value;
    return String(raw ?? "").toLowerCase().replace(/[\s_-]+/g, "") || "common";
  }

  static stockKey(rowOrPackId, documentId = null) {
    if (typeof rowOrPackId === "object") return `${rowOrPackId.packId}:${rowOrPackId.documentId}`;
    return `${rowOrPackId}:${documentId}`;
  }

  static isLimited(shop, row) {
    if (!shop) return false;
    if (shop.inventoryMode === "limited") return true;
    if (shop.inventoryMode === "unlimited") return false;
    return this.normalizeRarity(row.rarityKey) !== "common";
  }

  static getStock(shop, row) {
    if (!this.isLimited(shop, row)) return Infinity;
    return Math.max(0, Number(shop.stock?.[this.stockKey(row)] ?? 0));
  }

  static isInStock(shop, row) {
    return this.getStock(shop, row) > 0;
  }

  static async adjustStock(shopId, row, delta) {
    const shop = this.getShop(shopId);
    if (!shop || !this.isLimited(shop, row)) return;
    const key = this.stockKey(row);
    const current = Math.max(0, Number(shop.stock?.[key] ?? 0));
    shop.stock = { ...(shop.stock ?? {}), [key]: Math.max(0, current + delta) };
    await this.saveShop(shop, { bumpRevision: true });
  }

  static randomStockQuantity(rarity) {
    // The configured rarity counts represent how many different product
    // listings a restock should choose. Each chosen listing can itself have
    // multiple units on hand so Limited Stock does not collapse to quantity 1.
    const maxByRarity = { common: 6, uncommon: 4, rare: 2, veryrare: 1, legendary: 1 };
    const max = Math.max(1, Number(maxByRarity[this.normalizeRarity(rarity)] ?? 1));
    return 1 + Math.floor(Math.random() * max);
  }

  static buildRandomStock(shop, catalog) {
    const nextStock = {};
    const config = shop.randomInventory ?? {};
    const counts = config.counts ?? {};
    const groups = new Map();

    for (const row of catalog) {
      if (!this.isLimited(shop, row)) continue;
      const rarity = this.normalizeRarity(row.rarityKey);
      const rows = groups.get(rarity) ?? [];
      rows.push(row);
      groups.set(rarity, rows);
    }

    for (const [rarity, rows] of groups.entries()) {
      const target = Math.max(0, Number(counts[rarity] ?? 0));
      if (!target || !rows.length) continue;
      const pool = [...rows];
      for (let index = 0; index < target; index += 1) {
        if (!pool.length) break;
        const pickIndex = Math.floor(Math.random() * pool.length);
        const row = pool[pickIndex];
        const key = this.stockKey(row);
        nextStock[key] = (nextStock[key] ?? 0) + this.randomStockQuantity(rarity);
        if (!config.allowDuplicates) pool.splice(pickIndex, 1);
      }
    }
    return nextStock;
  }

  static async restock(shopId, catalog) {
    const shop = this.getShop(shopId);
    if (!shop) return null;

    if (shop.inventoryMode === "unlimited") {
      shop.stock = {};
    } else if (shop.randomInventory?.enabled) {
      const generated = this.buildRandomStock(shop, catalog);
      shop.stock = shop.restock?.behavior === "topup" ? { ...(shop.stock ?? {}), ...generated } : generated;
    }

    shop.restock = { ...(shop.restock ?? {}), lastRestockedAt: Date.now() };
    return this.saveShop(shop, { bumpRevision: true });
  }
}
