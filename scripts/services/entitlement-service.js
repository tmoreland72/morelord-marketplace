import { MODULE_ID } from "../constants.js";
import { Logger } from "../logger.js";

export const CORE_MODULE_ID = "morelord-core";
export const PRODUCT_SLUG = MODULE_ID;
export const GM_APPROVALS_FEATURE = "marketplace.gm-approvals";
// The website currently exposes the feature with the historical "markplace"
// spelling. Support both spellings so correcting the website key later does
// not require a module migration.
export const SHOP_MANAGER_FEATURE = "markplace.shop-manager";
export const SHOP_MANAGER_FEATURE_ALIAS = "marketplace.shop-manager";

export class EntitlementService {
  static get coreModule() {
    return game.modules.get(CORE_MODULE_ID) ?? null;
  }

  static get api() {
    return this.coreModule?.active ? this.coreModule.api ?? null : null;
  }

  static isCoreActive() {
    return Boolean(this.api);
  }

  static isConnected() {
    return Boolean(this.api?.isConnected?.());
  }

  static getTier() {
    return this.api?.getTier?.(PRODUCT_SLUG) ?? "standard";
  }

  static hasFeature(featureKey) {
    return Boolean(this.api?.hasFeature?.(featureKey, PRODUCT_SLUG));
  }

  static hasGmApprovals() {
    return this.hasFeature(GM_APPROVALS_FEATURE);
  }

  static hasShopManager() {
    const featureAccess = this.hasFeature(SHOP_MANAGER_FEATURE) || this.hasFeature(SHOP_MANAGER_FEATURE_ALIAS);
    if (featureAccess) return true;

    // Shop Manager is a Premium feature. Treat an explicitly reported Premium
    // or Champion Marketplace tier as valid access as a resilient fallback if
    // the feature list has not finished refreshing yet.
    return ["premium", "champion"].includes(String(this.getTier() ?? "").toLowerCase());
  }

  static getEntitlements() {
    return this.api?.getEntitlements?.(PRODUCT_SLUG) ?? null;
  }

  static async refresh({ quiet = true } = {}) {
    if (!this.api?.refresh) return null;

    try {
      return await this.api.refresh(PRODUCT_SLUG, { quiet });
    } catch (error) {
      Logger.error("Unable to refresh Marketplace entitlements", error);
      if (!quiet) {
        ui.notifications.error(error?.message ?? "Marketplace premium access could not be refreshed.");
      }
      return null;
    }
  }

  static openAccount() {
    if (this.api?.open) {
      this.api.open();
      return;
    }
    ui.notifications.warn("Morelord Core must be enabled before a Morelord account can be connected.");
  }

  static status() {
    const entitlements = this.getEntitlements();
    return {
      coreActive: this.isCoreActive(),
      connected: this.isConnected(),
      entitled: this.hasGmApprovals(),
      gmApprovals: this.hasGmApprovals(),
      shopManager: this.hasShopManager(),
      tier: this.getTier(),
      validatedAt: entitlements?.validatedAt ?? null,
      expiresAt: entitlements?.expiresAt ?? null
    };
  }
}
