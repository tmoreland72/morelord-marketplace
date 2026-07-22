import { MODULE_ID } from "../constants.js";

export class ShopService {
  static getShops() {
    return game.settings.get(MODULE_ID, "shops") ?? [];
  }

  static getCurrentShop() {
    const id = game.settings.get(MODULE_ID, "currentShop");
    if (!id) return null;

    return this.getShops().find(s => s.id === id) ?? null;
  }

  static async setCurrentShop(shopId) {
    await game.settings.set(MODULE_ID, "currentShop", shopId);
  }

  static entryPassesShop(entry, shop, packId) {
    if (!shop) return true;

    if (shop.compendiums?.length && !shop.compendiums.includes(packId)) {
      return false;
    }

    if (shop.itemTypes?.length && !shop.itemTypes.includes(entry.type)) {
      return false;
    }

    const rarity = entry.system?.rarity;
    if (shop.rarities?.length && rarity && !shop.rarities.includes(rarity)) {
      return false;
    }

    return true;
  }
}