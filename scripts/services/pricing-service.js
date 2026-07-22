import { MODULE_ID, DENOMINATION_TO_CP } from "../constants.js";

export class PricingService {
  static getItemPrice(item) {
    const override = item.getFlag?.(MODULE_ID, "customPrice");
    if (override) return override;

    const price = item.system?.price;
    if (!price) return null;

    if (typeof price === "number") {
      return { value: price, denomination: "gp" };
    }

    return {
      value: Number(price.value ?? 0),
      denomination: price.denomination ?? "gp"
    };
  }

  static getItemPriceCp(item) {
    const price = this.getItemPrice(item);
    if (!price) return 0;

    const value = Number(price.value ?? 0);
    const denomination = price.denomination ?? "gp";
    const multiplier = DENOMINATION_TO_CP[denomination] ?? 100;

    return Math.round(value * multiplier);
  }

  static applyShopModifier(priceCp, shop) {
    if (!shop?.priceModifier) return priceCp;
    return Math.round(priceCp * shop.priceModifier);
  }
}