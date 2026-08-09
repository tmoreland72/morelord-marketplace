import {
  MODULE_ID,
  FLAGS
} from "../constants.js";
import { Logger } from "../logger.js";

const CRAFTWORKS_MODULE_ID = "morelord-craftworks";
const CRAFTWORKS_PURCHASABLE_FLAG = "purchasable";

export class PurchaseEligibilityService {
  static getCraftworksIntegration() {
    const craftworks = game.modules.get(
      CRAFTWORKS_MODULE_ID
    );

    if (!craftworks?.active) {
      return null;
    }

    return (
      craftworks.api?.marketplaceIntegration ??
      null
    );
  }

  static getBooleanFlag(
    item,
    namespace,
    key
  ) {
    if (!item) return undefined;

    if (typeof item.getFlag === "function") {
      const value = item.getFlag(
        namespace,
        key
      );

      if (
        value === true ||
        value === false
      ) {
        return value;
      }
    }

    const value =
      item.flags?.[namespace]?.[key];

    return (
      value === true ||
      value === false
    )
      ? value
      : undefined;
  }

  /**
   * Determine whether an item may be purchased.
   *
   * This affects buying only; selling does not call this service.
   *
   * Priority:
   * 1. Preserve the older Marketplace-owned explicit false flag.
   * 2. If Craftworks is active, defer Craftworks item decisions to its
   *    public marketplaceIntegration API.
   * 3. Fall back to the Craftworks purchasable flag when needed.
   * 4. Items with no applicable override continue through normal
   *    Marketplace price/compendium rules.
   */
  static isPurchasable(item) {
    if (!item) return false;

    const legacyMarketplaceFlag =
      this.getBooleanFlag(
        item,
        MODULE_ID,
        FLAGS.PURCHASABLE
      );

    if (legacyMarketplaceFlag === false) {
      return false;
    }

    const craftworksFlag =
      this.getBooleanFlag(
        item,
        CRAFTWORKS_MODULE_ID,
        CRAFTWORKS_PURCHASABLE_FLAG
      );

    const integration =
      this.getCraftworksIntegration();

    if (
      integration &&
      typeof integration.isCraftworksItem === "function" &&
      typeof integration.isPurchasable === "function"
    ) {
      try {
        if (integration.isCraftworksItem(item)) {
          return integration.isPurchasable(item) === true;
        }
      } catch (error) {
        Logger.warn(
          "Craftworks Marketplace integration could not evaluate item; falling back to item flag.",
          {
            itemName: item.name,
            itemId: item.id ?? item._id,
            error
          }
        );
      }
    }

    if (craftworksFlag === false) {
      return false;
    }

    return true;
  }
}
