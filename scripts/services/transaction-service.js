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


  static contentLink(uuid, label) {
    const safeLabel = this.escape(label);
    if (!uuid) return `<strong>${safeLabel}</strong>`;
    return `<a class="content-link" data-link data-uuid="${this.escape(uuid)}">${safeLabel}</a>`;
  }

  static getItemUuid(transaction) {
    if (transaction?.itemUuid) return transaction.itemUuid;
    if (transaction?.payload?.itemUuid) return transaction.payload.itemUuid;

    const { packId, documentId } = transaction?.payload ?? {};
    return packId && documentId
      ? `Compendium.${packId}.Item.${documentId}`
      : null;
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

  static async post({ type, actor, fundingActor = actor, itemName, itemUuid = null, quantity, priceCp, shop = null }) {
    const enabled = game.settings.get(MODULE_ID, "postTransactionCards");
    if (!enabled) return null;

    const verb = type === "sell" ? "sold" : "bought";
    const price = CurrencyService.formatCp(priceCp);
    const approvalBypassed = !shop && this.wasApprovalBypassed(type);
    const fundingNotice = type === "buy" && fundingActor?.id && fundingActor.id !== actor.id
      ? `<p><strong>Paid from:</strong> ${this.escape(fundingActor.name)}</p>`
      : "";
    const shopNotice = shop?.name
      ? `<p><strong>Shop:</strong> ${this.escape(shop.name)}</p>`
      : "";

    const bypassNotice = approvalBypassed
      ? `
        <div class="ml-marketplace-approval-bypass">
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
        <div class="ml-chat-card ml-marketplace-card ml-marketplace-transaction-card ml-marketplace-transaction-complete">
          <div class="ml-marketplace-transaction-source">Morelord Marketplace</div>
          <p><strong>${this.escape(actor.name)}</strong> ${verb} <strong>${quantity} ×</strong> ${this.contentLink(itemUuid, itemName)}.</p>
          ${shopNotice}
          <p><strong>Total:</strong> ${this.escape(price)}</p>
          ${fundingNotice}
          ${bypassNotice}
        </div>
      `
    });
  }

  static async postCartPurchase({ actor, fundingActor = actor, shop, items = [] }) {
    const enabled = game.settings.get(MODULE_ID, "postTransactionCards");
    if (!enabled || !items.length) return null;

    const totalCp = items.reduce((sum, item) => sum + Number(item.totalPriceCp ?? 0), 0);
    const itemRows = items.map(item => `
      <div class="ml-marketplace-cart-chat-line">
        ${item.img ? `<img src="${this.escape(item.img)}" alt="${this.escape(item.name)}">` : ""}
        <span><strong>${Number(item.quantity ?? 1)} ×</strong> ${this.contentLink(item.uuid, item.name)}</span>
        <span>${this.escape(CurrencyService.formatCp(item.totalPriceCp ?? 0))}</span>
      </div>
    `).join("");
    const fundingNotice = fundingActor?.id && fundingActor.id !== actor.id
      ? `<p><strong>Paid from:</strong> ${this.escape(fundingActor.name)}</p>`
      : "";

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="ml-chat-card ml-marketplace-card ml-marketplace-transaction-card ml-marketplace-transaction-complete ml-marketplace-cart-transaction-card">
          <div class="ml-marketplace-transaction-source">Morelord Marketplace</div>
          <p><strong>${this.escape(actor.name)}</strong> purchased from <strong>${this.escape(shop?.name ?? "Marketplace Shop")}</strong>.</p>
          <div class="ml-marketplace-cart-chat-items">${itemRows}</div>
          <p><strong>Total:</strong> ${this.escape(CurrencyService.formatCp(totalCp))}</p>
          ${fundingNotice}
        </div>
      `
    });
  }

  static async postCart({ type, actor, fundingActor = actor, shop = null, items = [], totalCp = 0 }) {
    const enabled = game.settings.get(MODULE_ID, "postTransactionCards");
    if (!enabled || !items.length) return null;
    const verb = type === "sell" ? "sold" : "bought";
    const rows = items.map(item => `<div class="mlm-cart-chat-line">${item.img ? `<img src="${this.escape(item.img)}" alt="${this.escape(item.name)}">` : ""}<span><strong>${Number(item.quantity)} ×</strong> ${this.contentLink(item.uuid, item.name)}</span><span>${this.escape(CurrencyService.formatCp(item.totalPriceCp))}</span></div>`).join("");
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="morelord-marketplace-card mlm-transaction-card mlm-transaction-complete mlm-cart-transaction-card"><div class="mlm-transaction-source">Morelord Marketplace</div><p><strong>${this.escape(actor.name)}</strong> ${verb} a cart${shop?.name ? ` at <strong>${this.escape(shop.name)}</strong>` : ""}.</p><div class="mlm-cart-chat-items">${rows}</div><p><strong>Total:</strong> ${this.escape(CurrencyService.formatCp(totalCp))}</p>${type === "buy" && fundingActor?.id !== actor.id ? `<p><strong>Paid from:</strong> ${this.escape(fundingActor.name)}</p>` : ""}</div>` });
  }

  static async createPending({
    type,
    actor,
    fundingActor = actor,
    requestedByUserId,
    itemName,
    itemUuid = null,
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
      fundingActorUuid: fundingActor?.uuid ?? actor.uuid,
      fundingActorName: fundingActor?.name ?? actor.name,
      itemName,
      itemUuid,
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

    const lines = this.renderApprovalLines(transaction);
    return `
      <div class="ml-chat-card ml-marketplace-card ml-marketplace-approval-card" data-ml-marketplace-transaction-id="${this.escape(transaction.id)}">
        <div class="ml-marketplace-transaction-source">Morelord Marketplace</div>
        <div class="ml-marketplace-transaction-summary">
          ${transaction.itemImg ? `<img src="${this.escape(transaction.itemImg)}" alt="${this.escape(transaction.itemName)}">` : ""}
          <div>
            <p><strong>${this.escape(transaction.actorName)}</strong> requested to ${action} <strong>${this.escape(transaction.itemName)}</strong>.</p>
            ${lines}
            <p><strong>Total:</strong> ${this.escape(price)}</p>
            ${transaction.type === "buy" && transaction.fundingActorUuid !== transaction.actorUuid ? `<p><strong>Paying from:</strong> ${this.escape(transaction.fundingActorName)}</p>` : ""}
          </div>
        </div>
        <div class="ml-marketplace-approval-status ml-marketplace-status-pending">
          <i class="fa-solid fa-hourglass-half"></i>
          <span>Awaiting GM Approval</span>
        </div>
        <div class="ml-marketplace-gm-actions">
          <button type="button" data-ml-marketplace-approval-action="approve">
            <i class="fa-solid fa-check"></i>
            Approve
          </button>
          <button type="button" data-ml-marketplace-approval-action="deny">
            <i class="fa-solid fa-xmark"></i>
            Deny
          </button>
        </div>
      </div>
    `;
  }

  static renderProcessingCard(transaction, gmName) {
    return `
      <div class="ml-chat-card ml-marketplace-card ml-marketplace-approval-card">
        <div class="ml-marketplace-transaction-source">Morelord Marketplace</div>
        <p><strong>${this.escape(transaction.actorName)}</strong>'s request for <strong>${this.escape(transaction.itemName)}</strong> is being processed.</p>
        ${this.renderApprovalLines(transaction)}
        <div class="ml-marketplace-approval-status ml-marketplace-status-processing">
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
      ? "ml-marketplace-status-approved"
      : denied
        ? "ml-marketplace-status-denied"
        : "ml-marketplace-status-failed";
    const price = CurrencyService.formatCp(transaction.totalPriceCp);
    const action = transaction.type === "sell" ? "sell" : "buy";

    return `
      <div class="ml-chat-card ml-marketplace-card ml-marketplace-approval-card ml-marketplace-approval-resolved">
        <div class="ml-marketplace-transaction-source">Morelord Marketplace</div>
        <div class="ml-marketplace-approval-status ${statusClass}">
          <i class="fa-solid ${icon}"></i>
          <span>${label}</span>
        </div>
        <p><strong>${this.escape(transaction.actorName)}</strong>'s request to ${action} <strong>${this.escape(transaction.itemName)}</strong> was ${approved ? "approved" : denied ? "denied" : "not completed"}.</p>
        ${this.renderApprovalLines(transaction)}
        <p><strong>Total:</strong> ${this.escape(price)}</p>
        ${transaction.type === "buy" && transaction.fundingActorUuid !== transaction.actorUuid ? `<p><strong>Paid from:</strong> ${this.escape(transaction.fundingActorName)}</p>` : ""}
        ${reason ? `<p class="ml-marketplace-resolution-reason">${this.escape(reason)}</p>` : ""}
        <div class="ml-marketplace-resolution-meta">Resolved by ${this.escape(resolverName)}</div>
      </div>
    `;
  }

  static renderApprovalLines(transaction) {
    const items = transaction.payload?.items;
    if (!Array.isArray(items)) return `<p><strong>${Number(transaction.quantity ?? 1)} ×</strong> ${this.escape(transaction.itemName)}</p>`;
    return `<div class="ml-marketplace-cart-chat-items">${items.map(item => `<div class="ml-marketplace-cart-chat-line">${item.img ? `<img src="${this.escape(item.img)}" alt="${this.escape(item.name)}">` : ""}<span><strong>${Number(item.quantity)} ×</strong> ${this.contentLink(item.uuid, item.name)}</span><span>${this.escape(CurrencyService.formatCp(Number(item.unitPriceCp) * Number(item.quantity)))}</span></div>`).join("")}</div>`;
  }
}
