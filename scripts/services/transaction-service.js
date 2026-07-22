import { MODULE_ID } from "../constants.js";
import { CurrencyService } from "./currency-service.js";

export class TransactionService {
  static async post({ type, actor, itemName, quantity, priceCp }) {
    const enabled = game.settings.get(MODULE_ID, "postTransactionCards");
    if (!enabled) return;

    const verb = type === "sell" ? "sold" : "bought";
    const price = CurrencyService.formatCp(priceCp);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="morelord-marketplace-card">
          <h3>Morelord Marketplace</h3>
          <p><strong>${actor.name}</strong> ${verb} <strong>${quantity} × ${itemName}</strong>.</p>
          <p><strong>Total:</strong> ${price}</p>
        </div>
      `
    });
  }
}