/**
 * Normalized price object.
 */
export class PriceModel {
  constructor({ cp = 0, source = null } = {}) {
    this.cp = cp;
    this.source = source;
  }

  get isValid() {
    return Number.isFinite(this.cp) && this.cp >= 0;
  }
}