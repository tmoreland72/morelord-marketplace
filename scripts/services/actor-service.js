import { MODULE_ID, ITEM_TYPES } from "../constants.js";
import { PricingService } from "./pricing-service.js";
import { CurrencyService } from "./currency-service.js";
import { TransactionService } from "./transaction-service.js";
import { TransactionApprovalService } from "./transaction-approval-service.js";

export class ActorService {
  /**
   * Resolve the actor the Marketplace should operate on.
   *
   * Priority:
   * 1. Actor belonging to the first currently controlled token.
   * 2. Character assigned to the current user.
   *
   * Players must have OWNER permission for the resolved actor.
   * GMs may use any selected token actor.
   *
   * @returns {Actor|null}
   */
  static getMarketplaceActor() {
    const controlledTokens =
      game.canvas?.tokens?.controlled ??
      canvas?.tokens?.controlled ??
      [];

    const selectedActor =
      controlledTokens[0]?.actor ?? null;

    if (selectedActor) {
      const canUseSelectedActor =
        game.user.isGM ||
        selectedActor.testUserPermission(
          game.user,
          "OWNER"
        );

      if (canUseSelectedActor) {
        return selectedActor;
      }
    }

    const assignedActor =
      game.user.character ?? null;

    if (!assignedActor) return null;

    const canUseAssignedActor =
      game.user.isGM ||
      assignedActor.testUserPermission(
        game.user,
        "OWNER"
      );

    return canUseAssignedActor
      ? assignedActor
      : null;
  }

  static getUserActor() {
    return this.getMarketplaceActor();
  }

  static async getSellableItems(actor) {
    if (!actor) return [];

    const sellRate = Number(
      game.settings.get(MODULE_ID, "sellRate") ?? 1
    );

    return actor.items
      .filter(item => ITEM_TYPES.SELLABLE.includes(item.type))
      .filter(item => !item.getFlag(MODULE_ID, "unsellable"))
      .map(item => {
        const quantity = Number(item.system?.quantity ?? 1);
        const listPriceCp = PricingService.getItemPriceCp(item);
        const sellPriceCp = Math.floor(listPriceCp * sellRate);

        return {
          ownedItemId: item.id,
          uuid: item.uuid,
          name: item.name,
          img: item.img,
          type: item.type,
          quantity,
          listPriceCp,
          sellPriceCp,
          listPrice: CurrencyService.formatCp(listPriceCp),
          sellPrice: CurrencyService.formatCp(sellPriceCp)
        };
      })
      .filter(row => row.listPriceCp > 0);
  }

  static async sellItem(actor, itemId, quantity = 1) {
    if (!actor) {
      ui.notifications.error("Marketplace actor not found.");
      return;
    }

    if (!game.settings.get(MODULE_ID, "enableSelling")) {
      ui.notifications.warn("Selling is disabled.");
      return;
    }

    const item = actor.items.get(itemId);
    if (!item) {
      ui.notifications.error("Item not found.");
      return;
    }

    if (item.getFlag(MODULE_ID, "unsellable")) {
      ui.notifications.warn(`${item.name} cannot be sold.`);
      return;
    }

    const ownedQty = Number(item.system?.quantity ?? 1);
    const sellQty = Math.min(Number(quantity), ownedQty);
    if (!Number.isFinite(sellQty) || sellQty <= 0) return;

    const sellRate = Number(
      game.settings.get(MODULE_ID, "sellRate") ?? 1
    );
    const listPriceCp = PricingService.getItemPriceCp(item);
    const unitPriceCp = Math.floor(listPriceCp * sellRate);
    const totalSellCp = unitPriceCp * sellQty;

    if (TransactionApprovalService.requiresApproval("sell")) {
      await TransactionApprovalService.requestSell({
        actor,
        item,
        quantity: sellQty,
        unitPriceCp,
        totalPriceCp: totalSellCp
      });
      return;
    }

    await CurrencyService.addCurrency(actor, totalSellCp);

    if (ownedQty > sellQty) {
      await item.update({ "system.quantity": ownedQty - sellQty });
    } else {
      await item.delete();
    }

    await TransactionService.post({
      type: "sell",
      actor,
      itemName: item.name,
      quantity: sellQty,
      priceCp: totalSellCp
    });
  }
}
