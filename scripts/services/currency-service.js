import { DENOMINATION_TO_CP } from "../constants.js";

export class CurrencyService {
  static getCurrency(actor) {
    return actor.system.currency ?? {};
  }

  static currencyToCp(currency) {
    return (
      (currency.cp ?? 0) * DENOMINATION_TO_CP.cp +
      (currency.sp ?? 0) * DENOMINATION_TO_CP.sp +
      (currency.ep ?? 0) * DENOMINATION_TO_CP.ep +
      (currency.gp ?? 0) * DENOMINATION_TO_CP.gp +
      (currency.pp ?? 0) * DENOMINATION_TO_CP.pp
    );
  }

  static cpToCurrency(cp) {
    let remaining = Math.max(0, Math.floor(cp));

    const pp = Math.floor(remaining / 1000);
    remaining %= 1000;

    const gp = Math.floor(remaining / 100);
    remaining %= 100;

    const ep = Math.floor(remaining / 50);
    remaining %= 50;

    const sp = Math.floor(remaining / 10);
    remaining %= 10;

    const cpFinal = remaining;

    return { pp, gp, ep, sp, cp: cpFinal };
  }

  static async setCurrency(actor, cp) {
    const currency = this.cpToCurrency(cp);

    await actor.update({
      "system.currency.pp": currency.pp,
      "system.currency.gp": currency.gp,
      "system.currency.ep": currency.ep,
      "system.currency.sp": currency.sp,
      "system.currency.cp": currency.cp
    });
  }

  static async addCurrency(actor, cpToAdd) {
    const currentCp = this.currencyToCp(this.getCurrency(actor));
    await this.setCurrency(actor, currentCp + cpToAdd);
  }

  static async deductCurrency(actor, cpToDeduct) {
    const currentCp = this.currencyToCp(this.getCurrency(actor));

    if (currentCp < cpToDeduct) {
      throw new Error("Insufficient funds.");
    }

    await this.setCurrency(actor, currentCp - cpToDeduct);
  }

  static canAfford(actor, priceCp) {
    return this.currencyToCp(this.getCurrency(actor)) >= priceCp;
  }

  static formatCp(cp) {
    const c = this.cpToCurrency(cp);
    const parts = [];

    if (c.pp) parts.push(`${c.pp} pp`);
    if (c.gp) parts.push(`${c.gp} gp`);
    if (c.ep) parts.push(`${c.ep} ep`);
    if (c.sp) parts.push(`${c.sp} sp`);
    if (c.cp) parts.push(`${c.cp} cp`);

    return parts.length ? parts.join(", ") : "0 cp";
  }

  static getCurrencyDisplay(actor) {
    return this.formatCp(this.currencyToCp(this.getCurrency(actor)));
  }
}