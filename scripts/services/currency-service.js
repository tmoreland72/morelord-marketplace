import {
  addCurrency,
  canAfford,
  copperRate,
  cpToCurrency,
  currencyToCp,
  deductCurrency,
  getCurrency,
  setCurrency
} from "../../../morelord-core/scripts/services/currency-service.js";

const importedCurrency = Object.freeze({
  addCurrency,
  canAfford,
  copperRate,
  cpToCurrency,
  currencyToCp,
  deductCurrency,
  getCurrency,
  setCurrency
});

/** Prefer Core's published currency API. Node tests use the same module that API wraps. */
export function coreCurrency() {
  return globalThis.game?.modules?.get?.("morelord-core")?.api?.currency
    ?? globalThis.MorelordCore?.currency
    ?? importedCurrency;
}

const PRICE_DENOMINATIONS = ["pp", "gp", "ep", "sp", "cp"];

export class CurrencyService {
  static copperRate(denomination) {
    return coreCurrency().copperRate(denomination);
  }

  static getCurrency(actor) {
    return coreCurrency().getCurrency(actor);
  }

  static currencyToCp(currency) {
    return coreCurrency().currencyToCp(currency);
  }

  static cpToCurrency(cp) {
    return coreCurrency().cpToCurrency(cp);
  }

  static async setCurrency(actor, cp) {
    return coreCurrency().setCurrency(actor, cp);
  }

  static async addCurrency(actor, cpToAdd) {
    return coreCurrency().addCurrency(actor, cpToAdd);
  }

  static async deductCurrency(actor, cpToDeduct) {
    return coreCurrency().deductCurrency(actor, cpToDeduct);
  }

  static canAfford(actor, priceCp) {
    return coreCurrency().canAfford(actor, priceCp);
  }

  /**
   * Core formatCp prints gold, silver, and copper only.
   * Marketplace still names platinum and electrum, using Core's change-making split.
   */
  static formatCp(cp) {
    const purse = this.cpToCurrency(cp);
    const parts = [];
    for (const denomination of PRICE_DENOMINATIONS) {
      if (purse[denomination]) parts.push(`${purse[denomination]} ${denomination}`);
    }
    return parts.length ? parts.join(", ") : "0 cp";
  }

  static getCurrencyDisplay(actor) {
    return this.formatCp(this.currencyToCp(this.getCurrency(actor)));
  }
}
