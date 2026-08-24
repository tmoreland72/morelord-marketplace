import {
  MODULE_ID,
  FLAGS,
  TRANSACTION_STATUS
} from "../constants.js";
import { CurrencyService } from "./currency-service.js";
import { TransactionService } from "./transaction-service.js";
import { Logger } from "../logger.js";
import { PurchaseEligibilityService } from "./purchase-eligibility-service.js";
import { ShopService } from "./shop-service.js";
import { EntitlementService } from "./entitlement-service.js";
import { PricingService } from "./pricing-service.js";
import { CompendiumService } from "./compendium-service.js";

export class TransactionApprovalService {
  static initialized = false;
  static processingMessages = new Set();
  static socketName = `module.${MODULE_ID}`;

  static initialize() {
    if (this.initialized) return;
    this.initialized = true;

    document.addEventListener("click", event => {
      const button = event.target.closest("[data-ml-marketplace-approval-action]");
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const messageElement = button.closest("[data-message-id]");
      const messageId =
        messageElement?.dataset.messageId ??
        button.closest("li.chat-message")?.dataset.messageId ??
        null;

    const action = button.dataset.mlMarketplaceApprovalAction;
      if (!messageId || !action) return;

      void this.handleAction(messageId, action);
    });

    game.socket.on(this.socketName, payload => {
      if (payload?.action !== "transactionResolved") return;
      if (payload.userId !== game.user.id) return;

      const message = payload.status === TRANSACTION_STATUS.APPROVED
        ? `Your Marketplace request for ${payload.itemName} was approved.`
        : payload.status === TRANSACTION_STATUS.DENIED
          ? `Your Marketplace request for ${payload.itemName} was denied.`
          : `Your Marketplace request for ${payload.itemName} could not be completed.`;

      if (payload.status === TRANSACTION_STATUS.APPROVED) {
        ui.notifications.info(message);
      } else {
        ui.notifications.warn(message);
      }
    });
  }

  static requiresApproval(type) {
    if (game.user.isGM) return false;

    // GM approvals are optional premium behavior. A saved approval setting
    // must never block Standard buying or selling when no entitled account is
    // connected; preserve the setting so it becomes active again if premium
    // access returns.
    if (!EntitlementService.hasGmApprovals()) return false;

    const setting = type === "sell"
      ? "requireSellApproval"
      : "requireBuyApproval";

    return Boolean(game.settings.get(MODULE_ID, setting));
  }

  static prepareChatCard(message, html) {
    const transaction = TransactionService.getTransaction(message);
    if (!transaction) return;

    const root = html?.querySelector
      ? html
      : html?.[0] ?? null;

    if (!root) return;

    const controls = root.querySelectorAll(".ml-marketplace-gm-actions");
    const canResolve =
      game.user.isGM &&
      transaction.status === TRANSACTION_STATUS.PENDING;

    for (const control of controls) {
      control.hidden = !canResolve;
      control.style.display = canResolve ? "flex" : "none";
    }
  }

  static async requestBuy({ actor, fundingActor = actor, packId, documentId, item, priceCp, shopId = null }) {
    const message = await TransactionService.createPending({
      type: "buy",
      actor,
      fundingActor,
      requestedByUserId: game.user.id,
      itemName: item.name,
      itemUuid: item.uuid,
      itemImg: item.img,
      quantity: 1,
      unitPriceCp: priceCp,
      totalPriceCp: priceCp,
      payload: {
        packId,
        documentId,
        shopId
      }
    });

    ui.notifications.info(
      `${item.name} is awaiting GM approval.`
    );

    return message;
  }

  static async requestSell({
    actor,
    item,
    quantity,
    unitPriceCp,
    totalPriceCp
  }) {
    const message = await TransactionService.createPending({
      type: "sell",
      actor,
      requestedByUserId: game.user.id,
      itemName: item.name,
      itemUuid: item.getFlag("core", "sourceId") ?? item.uuid,
      itemImg: item.img,
      quantity,
      unitPriceCp,
      totalPriceCp,
      payload: {
        itemId: item.id,
        itemUuid: item.uuid
      }
    });

    ui.notifications.info(
      `${item.name} is awaiting GM approval.`
    );

    return message;
  }

  static async requestBuyCart({ actor, fundingActor = actor, items, totalPriceCp }) {
    return TransactionService.createPending({
      type: "buy",
      actor,
      fundingActor,
      requestedByUserId: game.user.id,
      itemName: `${items.length} cart item(s)`,
      itemImg: items[0]?.img,
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      unitPriceCp: null,
      totalPriceCp,
      payload: { items: items.map(item => ({ packId: item.packId, documentId: item.documentId, quantity: item.quantity, unitPriceCp: item.unitPriceCp, name: item.name, img: item.img, uuid: item.uuid })) }
    });
  }

  static async requestSellCart({ actor, items, totalPriceCp }) {
    return TransactionService.createPending({
      type: "sell",
      actor,
      requestedByUserId: game.user.id,
      itemName: `${items.length} cart item(s)`,
      itemImg: items[0]?.img,
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      unitPriceCp: null,
      totalPriceCp,
      payload: { items: items.map(item => ({ itemId: item.itemId, quantity: item.quantity, unitPriceCp: item.unitPriceCp, name: item.name, img: item.img, uuid: item.uuid })) }
    });
  }

  static async handleAction(messageId, action) {
    if (!game.user.isGM) {
      ui.notifications.error("Only a Game Master may resolve Marketplace requests.");
      return;
    }

    if (!["approve", "deny"].includes(action)) return;
    if (this.processingMessages.has(messageId)) return;

    const message = game.messages.get(messageId);
    if (!message) {
      ui.notifications.error("The Marketplace transaction message could not be found.");
      return;
    }

    const transaction = TransactionService.getTransaction(message);
    if (!transaction) {
      ui.notifications.error("This chat message does not contain a Marketplace transaction.");
      return;
    }

    if (transaction.status !== TRANSACTION_STATUS.PENDING) {
      ui.notifications.warn("This Marketplace transaction has already been resolved.");
      return;
    }

    this.processingMessages.add(messageId);

    try {
      if (action === "deny") {
        await this.resolveMessage(
          message,
          transaction,
          TRANSACTION_STATUS.DENIED,
          "Denied by the Game Master."
        );
        return;
      }

      const processingTransaction = {
        ...transaction,
        status: TRANSACTION_STATUS.PROCESSING,
        processingByUserId: game.user.id
      };

      await message.update({
        content: TransactionService.renderProcessingCard(
          processingTransaction,
          game.user.name
        ),
        [`flags.${MODULE_ID}.${FLAGS.TRANSACTION}`]: processingTransaction
      });

      try {
        if (transaction.type === "buy") {
          await this.executeApprovedBuy(transaction);
        } else if (transaction.type === "sell") {
          await this.executeApprovedSell(transaction);
        } else {
          throw new Error(`Unknown transaction type '${transaction.type}'.`);
        }

        await this.resolveMessage(
          message,
          transaction,
          TRANSACTION_STATUS.APPROVED
        );
      } catch (error) {
        Logger.error("Marketplace approval failed", error);
        await this.resolveMessage(
          message,
          transaction,
          TRANSACTION_STATUS.FAILED,
          error.message || "The transaction could not be completed."
        );
      }
    } finally {
      this.processingMessages.delete(messageId);
    }
  }

  static async executeApprovedBuy(transaction) {
    if (!game.settings.get(MODULE_ID, "enableBuying")) {
      throw new Error("Buying is currently disabled.");
    }

    const actor = await globalThis.fromUuid(transaction.actorUuid);
    if (!actor) throw new Error("The character could not be found.");

    const fundingActor = transaction.fundingActorUuid
      ? await globalThis.fromUuid(transaction.fundingActorUuid)
      : actor;
    if (!fundingActor) throw new Error("The selected source of purchase funds could not be found.");

    const cartLines = transaction.payload?.items;
    if (Array.isArray(cartLines)) return this.executeApprovedBuyCart(transaction, actor, fundingActor, cartLines);
    const { packId, documentId } = transaction.payload ?? {};
    const allowed = CompendiumService.getAllowedPackIds();

    if (!allowed.includes(packId)) {
      throw new Error("The source compendium is no longer allowed.");
    }

    const pack = game.packs.get(packId);
    if (!pack) throw new Error("The source compendium could not be found.");

    const item = await pack.getDocument(documentId);
    if (!item) throw new Error("The requested item could not be found.");

    if (!PurchaseEligibilityService.isPurchasable(item)) {
      throw new Error("The requested item is no longer available for purchase.");
    }

    if (!CurrencyService.canAfford(fundingActor, transaction.totalPriceCp)) {
      throw new Error("The selected purchase funds are no longer sufficient.");
    }

    const originalCurrencyCp = CurrencyService.currencyToCp(
      CurrencyService.getCurrency(fundingActor)
    );

    await CurrencyService.deductCurrency(fundingActor, transaction.totalPriceCp);

    try {
      await actor.createEmbeddedDocuments("Item", [item.toObject()]);
    } catch (error) {
      await CurrencyService.setCurrency(fundingActor, originalCurrencyCp);
      throw error;
    }
  }

  static async executeApprovedSell(transaction) {
    if (!game.settings.get(MODULE_ID, "enableSelling")) {
      throw new Error("Selling is currently disabled.");
    }

    const actor = await globalThis.fromUuid(transaction.actorUuid);
    if (!actor) throw new Error("The character could not be found.");

    const cartLines = transaction.payload?.items;
    if (Array.isArray(cartLines)) return this.executeApprovedSellCart(transaction, actor, cartLines);

    const itemId = transaction.payload?.itemId;
    const item = actor.items.get(itemId);

    if (!item) {
      throw new Error("The item is no longer in the character's inventory.");
    }

    if (item.getFlag(MODULE_ID, "unsellable")) {
      throw new Error("The item is no longer eligible for sale.");
    }

    const ownedQuantity = Number(item.system?.quantity ?? 1);
    const requestedQuantity = Number(transaction.quantity ?? 1);

    if (
      !Number.isFinite(ownedQuantity) ||
      !Number.isFinite(requestedQuantity) ||
      ownedQuantity < requestedQuantity ||
      requestedQuantity <= 0
    ) {
      throw new Error("The requested quantity is no longer available.");
    }

    const originalCurrencyCp = CurrencyService.currencyToCp(
      CurrencyService.getCurrency(actor)
    );

    await CurrencyService.addCurrency(actor, transaction.totalPriceCp);

    try {
      if (ownedQuantity > requestedQuantity) {
        await item.update({
          "system.quantity": ownedQuantity - requestedQuantity
        });
      } else {
        await item.delete();
      }
    } catch (error) {
      await CurrencyService.setCurrency(actor, originalCurrencyCp);
      throw error;
    }
  }

  static async executeApprovedBuyCart(transaction, actor, fundingActor, lines) {
    const allowed = new Set(CompendiumService.getAllowedPackIds());
    const documents = [];
    let liveTotal = 0;
    for (const line of lines) {
      if (!allowed.has(line.packId)) throw new Error("A source compendium is no longer allowed.");
      const item = await game.packs.get(line.packId)?.getDocument(line.documentId);
      const quantity = Number(line.quantity);
      if (!item || !PurchaseEligibilityService.isPurchasable(item) || !Number.isInteger(quantity) || quantity < 1) throw new Error("An item in the cart is no longer available.");
      const priceCp = PricingService.getBuyPriceCp(PricingService.getItemPriceCp(item));
      if (priceCp !== Number(line.unitPriceCp)) throw new Error(`${item.name}'s price changed.`);
      liveTotal += priceCp * quantity;
      documents.push(...Array.from({ length: quantity }, () => item.toObject()));
    }
    if (liveTotal !== Number(transaction.totalPriceCp)) throw new Error("The cart total changed.");
    if (!CurrencyService.canAfford(fundingActor, liveTotal)) throw new Error("The selected purchase funds are no longer sufficient.");
    const originalCurrencyCp = CurrencyService.currencyToCp(CurrencyService.getCurrency(fundingActor));
    const originalItemIds = new Set(actor.items.map(item => item.id));
    await CurrencyService.deductCurrency(fundingActor, liveTotal);
    try { await actor.createEmbeddedDocuments("Item", documents); }
    catch (error) {
      const rollbackErrors = [];
      const createdIds = actor.items.filter(item => !originalItemIds.has(item.id)).map(item => item.id);
      try { if (createdIds.length) await actor.deleteEmbeddedDocuments("Item", createdIds); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      try { await CurrencyService.setCurrency(fundingActor, originalCurrencyCp); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      if (rollbackErrors.length) throw new Error("The purchase failed and could not be fully rolled back. Review the character's inventory and currency.");
      throw error;
    }
  }

  static async executeApprovedSellCart(transaction, actor, lines) {
    const sellRate = Number(game.settings.get(MODULE_ID, "sellRate") ?? 1);
    const updates = [];
    const deletions = [];
    let liveTotal = 0;
    for (const line of lines) {
      const item = actor.items.get(line.itemId);
      const quantity = Number(line.quantity);
      const owned = Number(item?.system?.quantity ?? 0);
      if (!item || item.getFlag(MODULE_ID, "unsellable") || !Number.isInteger(quantity) || quantity < 1 || quantity > owned) throw new Error("An item in the cart is no longer available.");
      const priceCp = PricingService.getSellPriceCp(PricingService.getItemPriceCp(item), null, sellRate);
      if (priceCp !== Number(line.unitPriceCp)) throw new Error(`${item.name}'s sale price changed.`);
      liveTotal += priceCp * quantity;
      if (owned > quantity) updates.push({ _id: item.id, "system.quantity": owned - quantity }); else deletions.push(item.id);
    }
    if (liveTotal !== Number(transaction.totalPriceCp)) throw new Error("The cart total changed.");
    const originalCurrencyCp = CurrencyService.currencyToCp(CurrencyService.getCurrency(actor));
    const originalItems = new Map(lines.map(line => [line.itemId, actor.items.get(line.itemId).toObject()]));
    await CurrencyService.addCurrency(actor, liveTotal);
    try {
      if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
      if (deletions.length) await actor.deleteEmbeddedDocuments("Item", deletions);
    } catch (error) {
      const rollbackErrors = [];
      try { await CurrencyService.setCurrency(actor, originalCurrencyCp); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      const restores = [];
      const recreations = [];
      for (const [itemId, data] of originalItems) {
        if (actor.items.get(itemId)) restores.push({ _id: itemId, "system.quantity": data.system?.quantity ?? 1 });
        else recreations.push(data);
      }
      try { if (restores.length) await actor.updateEmbeddedDocuments("Item", restores); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      try { if (recreations.length) await actor.createEmbeddedDocuments("Item", recreations, { keepId: true }); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      if (rollbackErrors.length) throw new Error("The sale failed and could not be fully rolled back. Review the character's inventory and currency.");
      throw error;
    }
  }

  static async resolveMessage(message, transaction, status, reason = "") {
    if (
      transaction.type === "buy" &&
      transaction.payload?.shopId &&
      [TRANSACTION_STATUS.DENIED, TRANSACTION_STATUS.FAILED].includes(status)
    ) {
      const shop = ShopService.getShop(transaction.payload.shopId);
      if (shop) {
        const row = {
          packId: transaction.payload.packId,
          documentId: transaction.payload.documentId,
          rarityKey: "common"
        };
        const key = ShopService.stockKey(row);
        if (Object.prototype.hasOwnProperty.call(shop.stock ?? {}, key)) {
          shop.stock[key] = Math.max(0, Number(shop.stock[key] ?? 0)) + Number(transaction.quantity ?? 1);
          await ShopService.saveShop(shop);
        }
      }
    }

    const resolvedTransaction = {
      ...transaction,
      status,
      processingByUserId: null,
      resolvedByUserId: game.user.id,
      resolvedAt: Date.now(),
      resolutionReason: reason || null
    };

    await message.update({
      content: TransactionService.renderResolvedCard(
        resolvedTransaction,
        status,
        game.user.name,
        reason
      ),
      [`flags.${MODULE_ID}.${FLAGS.TRANSACTION}`]: resolvedTransaction
    });

    game.socket.emit(this.socketName, {
      action: "transactionResolved",
      userId: transaction.requestedByUserId,
      status,
      itemName: transaction.itemName,
      messageId: message.id
    });
  }
}
