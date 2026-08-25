import { MODULE_ID, ITEM_TYPES } from "../constants.js";
import { PricingService } from "./pricing-service.js";
import { CurrencyService } from "./currency-service.js";
import { TransactionService } from "./transaction-service.js";
import { TransactionApprovalService } from "./transaction-approval-service.js";
import { ShopService } from "./shop-service.js";

export class ActorService {
  /**
   * Resolve the actor the Marketplace should operate on.
   *
   * Priority:
   * 1. Character assigned to the current user.
   * 2. Character belonging to the first currently controlled token.
   * 3. First available Group actor.
   * 4. First available actor.
   *
   * @returns {Actor|null}
   */
  static getMarketplaceActor() {
    return this.getDefaultActor(this.getShopperActors());
  }

  /** Resolve a default from an already permission-filtered actor list. */
  static getDefaultActor(actors = []) {
    const candidates = Array.from(actors);
    const assignedActor = game.user.character ?? null;
    const assignedCharacter = candidates.find(actor =>
      actor.type === "character" && actor.id === assignedActor?.id
    );
    if (assignedCharacter) return assignedCharacter;

    const controlledTokens =
      game.canvas?.tokens?.controlled ??
      globalThis.canvas?.tokens?.controlled ??
      [];
    const activeCharacterId = controlledTokens
      .map(token => token.actor)
      .find(actor => actor?.type === "character")?.id;
    const activeCharacter = candidates.find(actor => actor.id === activeCharacterId);
    if (activeCharacter) return activeCharacter;

    return candidates.find(actor => actor.type === "group") ?? candidates[0] ?? null;
  }

  static getUserActor() {
    return this.getMarketplaceActor();
  }

  static canUserOperateActor(actor) {
    if (!actor || actor.getFlag?.(MODULE_ID, "isShop")) return false;
    return game.user.isGM || actor.testUserPermission?.(game.user, "OWNER");
  }

  static hasCurrency(actor) {
    return Boolean(actor?.system?.currency && typeof actor.system.currency === "object");
  }

  /** Return characters and groups the current user can shop, sell, or receive items as. */
  static getShopperActors() {
    return game.actors
      .filter(actor => actor.type === "character" || actor.type === "group")
      .filter(actor => this.canUserOperateActor(actor))
      .sort((a, b) => {
        const aGroup = a.type === "group" ? 0 : 1;
        const bGroup = b.type === "group" ? 0 : 1;
        return aGroup - bGroup || a.name.localeCompare(b.name);
      });
  }

  /** Return operable characters and Group actors whose currency may fund a purchase. */
  static getFundingActors() {
    return game.actors
      .filter(actor => actor.type === "character" || actor.type === "group")
      .filter(actor => this.canUserOperateActor(actor))
      .filter(actor => this.hasCurrency(actor))
      .sort((a, b) => {
        const aGroup = a.type === "group" ? 0 : 1;
        const bGroup = b.type === "group" ? 0 : 1;
        return aGroup - bGroup || a.name.localeCompare(b.name);
      });
  }

  static async getSellableItems(actor, { shop = null } = {}) {
    if (!actor) return [];

    const sellRate = Number(
      game.settings.get(MODULE_ID, "sellRate") ?? 1
    );

    return actor.items
      .filter(item => ITEM_TYPES.SELLABLE.includes(item.type))
      .filter(item => ShopService.entryMatchesItemOptions(item, shop))
      .filter(item => !item.getFlag(MODULE_ID, "unsellable"))
      .map(item => {
        const quantity = Number(item.system?.quantity ?? 1);
        const listPriceCp = PricingService.getItemPriceCp(item);
        const sellPriceCp = PricingService.getSellPriceCp(listPriceCp, shop, sellRate);

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
      .filter(row => row.listPriceCp > 0 && row.sellPriceCp !== null);
  }

  static async sellItem(actor, itemId, quantity = 1, { shop = null } = {}) {
    if (!actor) {
      ui.notifications.error("Marketplace actor not found.");
      return;
    }

    if (!shop && !game.settings.get(MODULE_ID, "enableSelling")) {
      ui.notifications.warn("Selling through the global Marketplace is disabled.");
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
    const unitPriceCp = PricingService.getSellPriceCp(listPriceCp, shop, sellRate);
    if (unitPriceCp === null) {
      ui.notifications.warn(`${shop?.name ?? "This shop"} will not buy from you at your current reputation.`);
      return;
    }
    const totalSellCp = unitPriceCp * sellQty;
    const itemUuid = item.getFlag("core", "sourceId") ?? item.uuid;

    if (!shop && TransactionApprovalService.requiresApproval("sell")) {
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
      itemUuid,
      quantity: sellQty,
      priceCp: totalSellCp,
      shop
    });
  }

  static async sellCart(actor, lines = [], { shop = null } = {}) {
    if (!actor || !lines.length) return { status: "blocked" };
    if (!shop && !game.settings.get(MODULE_ID, "enableSelling")) {
      ui.notifications.warn("Selling through the global Marketplace is disabled.");
      return { status: "blocked" };
    }

    const sellRate = Number(game.settings.get(MODULE_ID, "sellRate") ?? 1);
    const items = lines.map(line => {
      const item = actor.items.get(line.itemId);
      const quantity = Number(line.quantity);
      const ownedQuantity = Number(item?.system?.quantity ?? 0);
      if (!item || item.getFlag(MODULE_ID, "unsellable") || !Number.isInteger(quantity) || quantity < 1 || quantity > ownedQuantity) {
        throw new Error("An item in the sell cart is no longer available in the requested quantity.");
      }
      const unitPriceCp = PricingService.getSellPriceCp(PricingService.getItemPriceCp(item), shop, sellRate);
      if (unitPriceCp === null) throw new Error(`${shop?.name ?? "This shop"} will not buy ${item.name}.`);
      return { item, itemId: item.id, name: item.name, img: item.img, uuid: item.uuid, quantity, ownedQuantity, unitPriceCp, totalPriceCp: unitPriceCp * quantity };
    });
    const totalPriceCp = items.reduce((sum, entry) => sum + entry.totalPriceCp, 0);

    if (!shop && TransactionApprovalService.requiresApproval("sell")) {
      await TransactionApprovalService.requestSellCart({ actor, items, totalPriceCp });
      ui.notifications.info(`${items.length} sell-cart item(s) are awaiting GM approval.`);
      return { status: "pending" };
    }

    const originalCurrencyCp = CurrencyService.currencyToCp(CurrencyService.getCurrency(actor));
    const originalItems = new Map(items.map(entry => [entry.itemId, entry.item.toObject()]));
    await CurrencyService.addCurrency(actor, totalPriceCp);
    try {
      const updates = items.filter(entry => entry.ownedQuantity > entry.quantity).map(entry => ({ _id: entry.itemId, "system.quantity": entry.ownedQuantity - entry.quantity }));
      const deletions = items.filter(entry => entry.ownedQuantity <= entry.quantity).map(entry => entry.itemId);
      if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
      if (deletions.length) await actor.deleteEmbeddedDocuments("Item", deletions);
    } catch (error) {
      await this.rollbackSoldItems(actor, originalCurrencyCp, originalItems);
      throw error;
    }

    try {
      await TransactionService.postCart({ type: "sell", actor, items, totalCp: totalPriceCp, shop });
    } catch (error) {
      console.error(`[${MODULE_ID}] Sale completed, but its chat card could not be created`, error);
      ui.notifications.warn("The sale completed, but its chat card could not be created.");
    }
    return { status: "completed" };
  }

  static async rollbackSoldItems(actor, originalCurrencyCp, originalItems) {
    const rollbackErrors = [];
    try { await CurrencyService.setCurrency(actor, originalCurrencyCp); }
    catch (error) { rollbackErrors.push(error); }

    const updates = [];
    const recreations = [];
    for (const [itemId, data] of originalItems) {
      if (actor.items.get(itemId)) updates.push({ _id: itemId, "system.quantity": data.system?.quantity ?? 1 });
      else recreations.push(data);
    }
    try { if (updates.length) await actor.updateEmbeddedDocuments("Item", updates); }
    catch (error) { rollbackErrors.push(error); }
    try { if (recreations.length) await actor.createEmbeddedDocuments("Item", recreations, { keepId: true }); }
    catch (error) { rollbackErrors.push(error); }

    if (rollbackErrors.length) {
      console.error(`[${MODULE_ID}] Sell-cart rollback was incomplete`, rollbackErrors);
      throw new Error("The sale failed and could not be fully rolled back. A Game Master must review the character's inventory and currency.");
    }
  }
}
