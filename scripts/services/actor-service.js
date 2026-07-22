import { MODULE_ID, ITEM_TYPES } from "../constants.js";
import { PricingService } from "./pricing-service.js";
import { CurrencyService } from "./currency-service.js";
import { TransactionService } from "./transaction-service.js";

export class ActorService {
  static getMarketplaceActor() {
    // A GM may shop as a currently controlled token.
    if (game.user.isGM) {
      console.log("Controlled tokens:", game.canvas?.tokens?.controlled);
      console.log("Marketplace actor:", game.canvas?.tokens?.controlled?.[0]?.actor);
      const controlled = game.canvas.tokens?.controlled ?? [];

      if (controlled.length > 0) {
        return controlled[0].actor ?? null;
      }
    }

    // Normal player behavior.
    return game.user.character ?? null;
  }

  static getUserActor() {
    return this.getMarketplaceActor();
  }

  static async getSellableItems(actor) {
    const sellRate = game.settings.get(MODULE_ID, "sellRate");

    return actor.items
      .filter(item => ITEM_TYPES.SELLABLE.includes(item.type))
      .filter(item => !item.getFlag(MODULE_ID, "unsellable"))
      .map(item => {
        const quantity = item.system.quantity ?? 1;
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
    if (!game.settings.get(MODULE_ID, "enableSelling")) {
      ui.notifications.warn("Selling is disabled.");
      return;
    }

    const item = actor.items.get(itemId);
    if (!item) {
      ui.notifications.error("Item not found.");
      return;
    }

    const ownedQty = item.system.quantity ?? 1;
    const sellQty = Math.min(quantity, ownedQty);

    if (sellQty <= 0) return;

    const sellRate = game.settings.get(MODULE_ID, "sellRate");
    const listPriceCp = PricingService.getItemPriceCp(item);
    const totalSellCp = Math.floor(listPriceCp * sellRate * sellQty);

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