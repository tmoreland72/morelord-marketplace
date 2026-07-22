export class TransactionModel {
  constructor({
    type,
    actorId,
    itemName,
    quantity = 1,
    priceCp = 0,
    timestamp = Date.now()
  }) {
    this.type = type; // "buy" or "sell"
    this.actorId = actorId;
    this.itemName = itemName;
    this.quantity = quantity;
    this.priceCp = priceCp;
    this.timestamp = timestamp;
  }
}