export const MODULE_ID = "morelord-marketplace";

export const ITEM_TYPES = {
  SELLABLE: ["weapon", "equipment", "consumable", "tool", "loot"],
  BUYABLE: ["weapon", "equipment", "consumable", "tool", "loot"]
};

export const DENOMINATION_TO_CP = {
  cp: 1,
  sp: 10,
  ep: 50,
  gp: 100,
  pp: 1000
};

export const DEFAULT_SELL_RATE = 0.5;

export const FLAGS = {
  UNSELLABLE: "unsellable",
  CUSTOM_PRICE: "customPrice",
  MARKETPLACE_TAGS: "marketplaceTags",
  SHOP_ID: "shopId",
  WISHLIST: "wishlist"
};