import { listCharacterActors } from "../../../morelord-core/scripts/ui/actor-participation.js";
import { ITEM_TYPES, MODULE_ID } from "../constants.js";
import { TransactionService } from "./transaction-service.js";

export class TransferService {
  static requests = new Map();

  static initialize() {
    this.channel = globalThis.MorelordCore.socket.createChannel(`${MODULE_ID}.transfer`);
    // ponytail: serialize transfers globally; use actor locks if transfer volume requires it.
    this.channel.on("checkout", (data, context) => this.resolve(data, context.senderUserId), { serialize: `${MODULE_ID}.transfer` });
  }

  static targets(source) {
    return [...listCharacterActors(), ...game.actors.filter(actor => actor.type === "group")]
      .filter(actor => actor.id !== source?.id && !actor.getFlag?.(MODULE_ID, "isShop"))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  static items(actor) {
    return Array.from(actor?.items ?? []).filter(item => ITEM_TYPES.SELLABLE.includes(item.type)
      && Number.isInteger(item.system?.quantity) && item.system.quantity > 0
      && !Array.from(actor.items).some(child => child.system?.container === item.id));
  }

  static checkout(data) {
    const request = { ...data, requestId: foundry.utils.randomID(24) };
    return game.user.isGM ? this.channel.executeAsUser("checkout", request, game.user.id) : this.channel.executeAsGM("checkout", request);
  }

  static resolve(data, userId) {
    if (typeof data?.requestId !== "string" || !data.requestId) throw new Error("Invalid transfer request.");
    const key = userId + ":" + data.requestId;
    if (!this.requests.has(key)) {
      // ponytail: retain the latest 1000 requests per GM session; persistent receipts if recovery across reloads is needed.
      if (this.requests.size >= 1000) this.requests.delete(this.requests.keys().next().value);
      this.requests.set(key, this.execute(data, userId));
    }
    return this.requests.get(key);
  }

  static async execute({ actorId, targetId, items }, userId) {
    if (!game.user.isGM) throw new Error("A connected Game Master is required to transfer items.");
    const actor = game.actors.get(actorId), target = game.actors.get(targetId), user = game.users.get(userId);
    if (!user?.active || !actor || (!user.isGM && !actor.testUserPermission(user, "OWNER"))
      || actor.getFlag?.(MODULE_ID, "isShop") || !["character", "group"].includes(actor.type)
      || !this.targets(actor).some(candidate => candidate.id === targetId)) throw new Error("The source or recipient is no longer eligible for this transfer.");
    if (!Array.isArray(items) || !items.length || items.some(line => !line || typeof line.itemId !== "string") || new Set(items.map(line => line.itemId)).size !== items.length) throw new Error("Invalid transfer cart.");
    const eligible = new Set(this.items(actor).map(item => item.id));
    const lines = items.map(({ itemId, quantity }) => {
      const item = actor.items.get(itemId);
      if (!eligible.has(itemId) || !Number.isInteger(quantity) || quantity < 1 || quantity > item.system.quantity) throw new Error("An item is no longer available in the requested quantity. Review your transfer cart.");
      return { item, quantity, original: item.toObject() };
    });
    const transferIds = lines.map(() => foundry.utils.randomID());
    let created;
    let sourceMutationStarted = false;
    try {
      created = await target.createEmbeddedDocuments("Item", lines.map(({ original, quantity }, index) => {
        const data = foundry.utils.deepClone(original);
        data._id = transferIds[index];
        data.system.quantity = quantity;
        data.system.container = null;
        if ("equipped" in data.system) data.system.equipped = false;
        if ("attuned" in data.system) data.system.attuned = false;
        return data;
      }), { keepId: true });
      if (created.length !== lines.length) throw new Error("The recipient could not receive every item.");
      if (lines.some(line => actor.items.get(line.item.id)?.system.quantity !== line.original.system.quantity)) throw new Error("The sending inventory changed during transfer. Review your cart and try again.");
      const updates = lines.filter(line => line.original.system.quantity > line.quantity)
        .map(line => ({ _id: line.item.id, "system.quantity": line.original.system.quantity - line.quantity }));
      const deletions = lines.filter(line => line.original.system.quantity === line.quantity).map(line => line.item.id);
      sourceMutationStarted = true;
      if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
      if (deletions.length) await actor.deleteEmbeddedDocuments("Item", deletions);
    } catch (error) {
      try {
        // Include documents persisted before a partially failed creation call.
        const added = transferIds.filter(id => target.items.get(id));
        if (added.length) await target.deleteEmbeddedDocuments("Item", added);
        const updates = lines.filter(line => actor.items.get(line.item.id)).map(line => ({ _id: line.item.id, "system.quantity": line.original.system.quantity }));
        const missing = lines.filter(line => !actor.items.get(line.item.id)).map(line => line.original);
        if (sourceMutationStarted && updates.length) await actor.updateEmbeddedDocuments("Item", updates);
        if (sourceMutationStarted && missing.length) await actor.createEmbeddedDocuments("Item", missing, { keepId: true });
      } catch (rollbackError) {
        console.error(`[${MODULE_ID}] Transfer rollback failed`, error, rollbackError);
        throw new Error("Transfer recovery was incomplete. Do not retry; ask the GM to review both inventories.");
      }
      throw error;
    }
    try {
      await TransactionService.postTransfer({ actor, target, items: created.map((item, index) => ({ name: item.name, img: item.img, uuid: item.uuid, quantity: lines[index].quantity })) });
    } catch (error) {
      console.error(`[${MODULE_ID}] Transfer completed without a chat card`, error);
      return { status: "completed", warning: "Items were transferred, but the chat card could not be created." };
    }
    return { status: "completed" };
  }
}
