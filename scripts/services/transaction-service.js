import {
  MODULE_ID,
  FLAGS,
  TRANSACTION_STATUS
} from "../constants.js";
import { CurrencyService } from "./currency-service.js";

export class TransactionService {
  static escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  static getTransaction(message) {
    return message?.getFlag(MODULE_ID, FLAGS.TRANSACTION) ?? null;
  }

  /**
   * Determine whether an immediate transaction bypassed an enabled
   * approval requirement because it was initiated by a GM.
   *
   * @param {"buy"|"sell"} type
   * @returns {boolean}
   */
  static wasApprovalBypassed(type) {
    if (!game.user.isGM) return false;

    const settingName =
      type === "sell"
        ? "requireSellApproval"
        : "requireBuyApproval";

    return Boolean(
      game.settings.get(
        MODULE_ID,
        settingName
      )
    );
  }

  static async post({ type, actor, itemName, quantity, priceCp }) {
    const enabled = game.settings.get(MODULE_ID, "postTransactionCards");
    if (!enabled) return null;

    const verb = type === "sell" ? "sold" : "bought";
    const price = CurrencyService.formatCp(priceCp);
    const approvalBypassed = this.wasApprovalBypassed(type);

    const bypassNotice = approvalBypassed
      ? `
        <div class="mlm-approval-bypass">
          <i class="fa-solid fa-shield-halved"></i>
          <span>
            GM approval was bypassed because this transaction
            was initiated by a Game Master.
          </span>
        </div>
      `
      : "";

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="morelord-marketplace-card mlm-transaction-card mlm-transaction-complete">
          <div class="mlm-transaction-source">Morelord Marketplace</div>
          <p><strong>${this.escape(actor.name)}</strong> ${verb} <strong>${quantity} × ${this.escape(itemName)}</strong>.</p>
          <p><strong>Total:</strong> ${this.escape(price)}</p>
          ${bypassNotice}
        </div>
      `
    });
  }

  static async createPending({
    type,
    actor,
    requestedByUserId,
    itemName,
    itemImg,
    quantity,
    unitPriceCp,
    totalPriceCp,
    payload
  }) {
    const transaction = {
      id: foundry.utils.randomID(),
      type,
      status: TRANSACTION_STATUS.PENDING,
      requestedByUserId,
      actorUuid: actor.uuid,
      actorName: actor.name,
      itemName,
      itemImg,
      quantity,
      unitPriceCp,
      totalPriceCp,
      payload,
      createdAt: Date.now(),
      processingByUserId: null,
      resolvedByUserId: null,
      resolvedAt: null,
      resolutionReason: null
    };

    const recipients = [
      requestedByUserId,
      ...game.users
        .filter(user => user.isGM)
        .map(user => user.id)
    ].filter(Boolean);

    return ChatMessage.create({
      user: requestedByUserId,
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper: [...new Set(recipients)],
      content: this.renderPendingCard(transaction),
      flags: {
        [MODULE_ID]: {
          [FLAGS.TRANSACTION]: transaction
        }
      }
    });
  }

  static renderPendingCard(transaction) {
    const action = transaction.type === "sell" ? "sell" : "buy";
    const price = CurrencyService.formatCp(transaction.totalPriceCp);

    return `
      <div class="morelord-marketplace-card mlm-approval-card" data-mlm-transaction-id="${this.escape(transaction.id)}">
        <div class="mlm-transaction-source">Morelord Marketplace</div>
        <div class="mlm-transaction-summary">
          ${transaction.itemImg ? `<img src="${this.escape(transaction.itemImg)}" alt="${this.escape(transaction.itemName)}">` : ""}
          <div>
            <p><strong>${this.escape(transaction.actorName)}</strong> requested to ${action} <strong>${transaction.quantity} × ${this.escape(transaction.itemName)}</strong>.</p>
            <p><strong>Total:</strong> ${this.escape(price)}</p>
          </div>
        </div>
        <div class="mlm-approval-status mlm-status-pending">
          <i class="fa-solid fa-hourglass-half"></i>
          <span>Awaiting GM Approval</span>
        </div>
        <div class="mlm-gm-actions">
          <button type="button" data-mlm-approval-action="approve">
            <i class="fa-solid fa-check"></i>
            Approve
          </button>
          <button type="button" data-mlm-approval-action="deny">
            <i class="fa-solid fa-xmark"></i>
            Deny
          </button>
        </div>
      </div>
    `;
  }

  static renderProcessingCard(transaction, gmName) {
    return `
      <div class="morelord-marketplace-card mlm-approval-card">
        <div class="mlm-transaction-source">Morelord Marketplace</div>
        <p><strong>${this.escape(transaction.actorName)}</strong>'s request for <strong>${transaction.quantity} × ${this.escape(transaction.itemName)}</strong> is being processed.</p>
        <div class="mlm-approval-status mlm-status-processing">
          <i class="fa-solid fa-spinner fa-spin"></i>
          <span>Processing by ${this.escape(gmName)}</span>
        </div>
      </div>
    `;
  }

  static renderResolvedCard(transaction, status, resolverName, reason = "") {
    const approved = status === TRANSACTION_STATUS.APPROVED;
    const denied = status === TRANSACTION_STATUS.DENIED;
    const icon = approved
      ? "fa-circle-check"
      : denied
        ? "fa-circle-xmark"
        : "fa-triangle-exclamation";
    const label = approved ? "Approved" : denied ? "Denied" : "Unable to Complete";
    const statusClass = approved
      ? "mlm-status-approved"
      : denied
        ? "mlm-status-denied"
        : "mlm-status-failed";
    const price = CurrencyService.formatCp(transaction.totalPriceCp);
    const action = transaction.type === "sell" ? "sell" : "buy";

    return `
      <div class="morelord-marketplace-card mlm-approval-card mlm-approval-resolved">
        <div class="mlm-transaction-source">Morelord Marketplace</div>
        <div class="mlm-approval-status ${statusClass}">
          <i class="fa-solid ${icon}"></i>
          <span>${label}</span>
        </div>
        <p><strong>${this.escape(transaction.actorName)}</strong>'s request to ${action} <strong>${transaction.quantity} × ${this.escape(transaction.itemName)}</strong> was ${approved ? "approved" : denied ? "denied" : "not completed"}.</p>
        <p><strong>Total:</strong> ${this.escape(price)}</p>
        ${reason ? `<p class="mlm-resolution-reason">${this.escape(reason)}</p>` : ""}
        <div class="mlm-resolution-meta">Resolved by ${this.escape(resolverName)}</div>
      </div>
    `;
  }
}
