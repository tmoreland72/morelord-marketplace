export const MODULE_ID = "morelord-marketplace";

export const ITEM_TYPES = {
  SELLABLE: [
    "weapon",
    "equipment",
    "consumable",
    "tool",
    "loot",
    "container"
  ],
  BUYABLE: [
    "weapon",
    "equipment",
    "consumable",
    "tool",
    "loot",
    "container"
  ]
};

export const DENOMINATION_TO_CP = {
  cp: 1,
  sp: 10,
  ep: 50,
  gp: 100,
  pp: 1000
};

export const DEFAULT_SELL_RATE = 1;

export const FLAGS = {
  UNSELLABLE: "unsellable",
  CUSTOM_PRICE: "customPrice",
  MARKETPLACE_TAGS: "marketplaceTags",
  SHOP_ID: "shopId",
  WISHLIST: "wishlist",
  TRANSACTION: "transaction",
  PURCHASABLE: "purchasable"
};

export const TRANSACTION_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  APPROVED: "approved",
  DENIED: "denied",
  FAILED: "failed"
};

export const RARITY_OPTIONS = [
  { value: "common", label: "Common", order: 0 },
  { value: "uncommon", label: "Uncommon", order: 1 },
  { value: "rare", label: "Rare", order: 2 },
  { value: "veryRare", label: "Very Rare", order: 3 },
  { value: "legendary", label: "Legendary", order: 4 },
  { value: "artifact", label: "Artifact", order: 5 }
];

export const RARITY_ORDER = Object.fromEntries(
  RARITY_OPTIONS.map(({ value, order }) => [value, order])
);
