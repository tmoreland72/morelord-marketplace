import { MODULE_ID, DENOMINATION_TO_CP } from "../constants.js";
import { ShopService } from "./shop-service.js";
import { itemRarity } from "../../../morelord-core/scripts/services/item-rarity.js";

// Standard rarity values in GP (2024 SRD); artifacts have no standard price.
const RARITY_PRICE_GP = new Map(Object.entries({
  common: 100, uncommon: 400, rare: 4000, veryrare: 40000, legendary: 200000
}));

export class PricingService {
  static getItemPrice(item) {
    const override = item.getFlag?.(MODULE_ID, "customPrice")
      ?? item.flags?.[MODULE_ID]?.customPrice;
    if (override) return override;

    const price = item.system?.price;
    const value = Number(typeof price === "number" ? price : price?.value);
    if (Number.isFinite(value) && value > 0) {
      return { value, denomination: price?.denomination ?? "gp" };
    }
    const fallback = RARITY_PRICE_GP.get(itemRarity(item.system) ?? "common");
    return fallback ? { value: fallback, denomination: "gp" } : null;
  }

  static getItemPriceCp(item) {
    const price = this.getItemPrice(item);
    if (!price) return 0;
    const value = Number(price.value ?? 0);
    const denomination = price.denomination ?? "gp";
    return Math.round(value * (DENOMINATION_TO_CP[denomination] ?? 100));
  }

  static getBuyPriceCp(basePriceCp, shop = null) {
    if (!shop) {
      if (game.settings.get(MODULE_ID, "ignoreGlobalRates") === true) return Math.max(0, Math.round(basePriceCp));
      const rate = Number(game.settings.get(MODULE_ID, "buyRate") ?? 1);
      return Math.round(basePriceCp * (Number.isFinite(rate) ? Math.max(1, rate) : 1));
    }
    const reputation = ShopService.getReputationTier(shop);
    if (reputation.buyModifier === null) return null;
    return Math.max(0, Math.round(basePriceCp * Number(shop.buyModifier ?? 1) * reputation.buyModifier));
  }

  static getSellPriceCp(basePriceCp, shop = null, globalSellRate = 1) {
    if (!shop) {
      if (game.settings.get(MODULE_ID, "ignoreGlobalRates") === true) return Math.max(0, Math.round(basePriceCp));
      if (basePriceCp <= 0) return 0;
      return Math.max(1, Math.floor(basePriceCp * globalSellRate));
    }
    const reputation = ShopService.getReputationTier(shop);
    if (reputation.sellModifier === null) return null;
    if (basePriceCp <= 0) return 0;
    return Math.max(1, Math.floor(basePriceCp * Number(shop.sellModifier ?? globalSellRate) * reputation.sellModifier));
  }

  static applyShopModifier(priceCp, shop) {
    return this.getBuyPriceCp(priceCp, shop) ?? 0;
  }
}
