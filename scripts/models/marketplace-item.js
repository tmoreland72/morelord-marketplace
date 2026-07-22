export class MarketplaceItemModel {
  constructor({
    id,
    name,
    type,
    img,
    quantity = 1,
    rarity = "",
    source = "",
    packId = null,
    documentId = null,
    listPriceCp = 0,
    sellPriceCp = 0,
    buyPriceCp = 0,
    ownedItemId = null
  }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.img = img;
    this.quantity = quantity;
    this.rarity = rarity;
    this.source = source;
    this.packId = packId;
    this.documentId = documentId;
    this.listPriceCp = listPriceCp;
    this.sellPriceCp = sellPriceCp;
    this.buyPriceCp = buyPriceCp;
    this.ownedItemId = ownedItemId;
  }
}