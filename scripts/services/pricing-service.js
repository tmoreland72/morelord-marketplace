import { MODULE_ID, DENOMINATION_TO_CP } from "../constants.js";
import { ShopService } from "./shop-service.js";

export class PricingService {
  static getItemPrice(item) {
    const override = item.getFlag?.(MODULE_ID, "customPrice")
      ?? item.flags?.[MODULE_ID]?.customPrice;
    if (override) return override;

    const price = item.system?.price;
    if (!price) return null;

    if (typeof price === "number") return { value: price, denomination: "gp" };
    return { value: Number(price.value ?? 0), denomination: price.denomination ?? "gp" };
  }

  static getItemPriceCp(item) {
    const price = this.getItemPrice(item);
    if (!price) return 0;
    const value = Number(price.value ?? 0);
    const denomination = price.denomination ?? "gp";
    return Math.round(value * (DENOMINATION_TO_CP[denomination] ?? 100));
  }

  static getBuyPriceCp(basePriceCp, shop = null) {
    if (!shop) return Math.round(basePriceCp);
    const reputation = ShopService.getReputationTier(shop);
    if (reputation.buyModifier === null) return null;
    return Math.max(0, Math.round(basePriceCp * Number(shop.buyModifier ?? 1) * reputation.buyModifier));
  }

  static getSellPriceCp(basePriceCp, shop = null, globalSellRate = 1) {
    if (!shop) {
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
