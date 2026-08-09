import {
  MODULE_ID,
  FLAGS,
  TRANSACTION_STATUS
} from "../constants.js";
import { CurrencyService } from "./currency-service.js";
import { TransactionService } from "./transaction-service.js";
import { Logger } from "../logger.js";

export class TransactionApprovalService {
  static initialized = false;
  static processingMessages = new Set();
  static socketName = `module.${MODULE_ID}`;

  static initialize() {
    if (this.initialized) return;
    this.initialized = true;

    document.addEventListener("click", event => {
      const button = event.target.closest("[data-mlm-approval-action]");
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const messageElement = button.closest("[data-message-id]");
      const messageId =
        messageElement?.dataset.messageId ??
        button.closest("li.chat-message")?.dataset.messageId ??
        null;

      const action = button.dataset.mlmApprovalAction;
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

    const controls = root.querySelectorAll(".mlm-gm-actions");
    const canResolve =
      game.user.isGM &&
      transaction.status === TRANSACTION_STATUS.PENDING;

    for (const control of controls) {
      control.hidden = !canResolve;
      control.style.display = canResolve ? "flex" : "none";
    }
  }

  static async requestBuy({ actor, packId, documentId, item, priceCp }) {
    const message = await TransactionService.createPending({
      type: "buy",
      actor,
      requestedByUserId: game.user.id,
      itemName: item.name,
      itemImg: item.img,
      quantity: 1,
      unitPriceCp: priceCp,
      totalPriceCp: priceCp,
      payload: {
        packId,
        documentId
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

    const { packId, documentId } = transaction.payload ?? {};
    const allowed = game.settings.get(MODULE_ID, "allowedCompendiums") ?? [];

    if (!allowed.includes(packId)) {
      throw new Error("The source compendium is no longer allowed.");
    }

    const pack = game.packs.get(packId);
    if (!pack) throw new Error("The source compendium could not be found.");

    const item = await pack.getDocument(documentId);
    if (!item) throw new Error("The requested item could not be found.");

    if (item.getFlag(MODULE_ID, FLAGS.PURCHASABLE) === false) {
      throw new Error("The requested item is no longer available for purchase.");
    }

    if (!CurrencyService.canAfford(actor, transaction.totalPriceCp)) {
      throw new Error("The character can no longer afford this purchase.");
    }

    const originalCurrencyCp = CurrencyService.currencyToCp(
      CurrencyService.getCurrency(actor)
    );

    await CurrencyService.deductCurrency(actor, transaction.totalPriceCp);

    try {
      await actor.createEmbeddedDocuments("Item", [item.toObject()]);
    } catch (error) {
      await CurrencyService.setCurrency(actor, originalCurrencyCp);
      throw error;
    }
  }

  static async executeApprovedSell(transaction) {
    if (!game.settings.get(MODULE_ID, "enableSelling")) {
      throw new Error("Selling is currently disabled.");
    }

    const actor = await globalThis.fromUuid(transaction.actorUuid);
    if (!actor) throw new Error("The character could not be found.");

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

  static async resolveMessage(message, transaction, status, reason = "") {
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
