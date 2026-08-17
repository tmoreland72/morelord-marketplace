export const SHOP_ITEM_OPTIONS = {
  weapon: { label: "Weapons", itemTypes: ["weapon"] },
  armor: { label: "Armor", itemTypes: ["equipment"], subtypes: ["light", "medium", "heavy", "shield", "armor"] },
  equipment: { label: "Other Equipment", itemTypes: ["equipment"], excludeSubtypes: ["light", "medium", "heavy", "shield", "armor"] },
  potion: { label: "Potions", itemTypes: ["consumable"], subtypes: ["potion"] },
  spellScroll: { label: "Spell Scrolls", itemTypes: ["consumable"], subtypes: ["scroll"] },
  consumable: { label: "Other Consumables", itemTypes: ["consumable"], excludeSubtypes: ["potion", "scroll"] },
  artisanTool: { label: "Artisan Tools", itemTypes: ["tool"], subtypes: ["art"] },
  tool: { label: "Other Tools", itemTypes: ["tool"], excludeSubtypes: ["art"] },
  loot: { label: "Loot", itemTypes: ["loot"] },
  container: { label: "Containers", itemTypes: ["container"] }
};

export function getItemTypesForOptions(optionKeys = []) {
  return [...new Set(optionKeys.flatMap(key => SHOP_ITEM_OPTIONS[key]?.itemTypes ?? []))];
}

export const SHOP_TYPES = {
  general: {
    label: "General Store",
    icon: "fa-basket-shopping",
    itemOptions: ["weapon", "armor", "equipment", "potion", "spellScroll", "consumable", "artisanTool", "tool", "loot", "container"],
    rarities: ["common", "uncommon"],
    buyModifier: 1,
    sellModifier: 0.5
  },
  weaponsmith: {
    label: "Weaponsmith",
    icon: "fa-hammer",
    itemOptions: ["weapon"],
    rarities: ["common", "uncommon", "rare"],
    buyModifier: 1,
    sellModifier: 0.5
  },
  armorer: {
    label: "Armorer",
    icon: "fa-shield-halved",
    itemOptions: ["armor"],
    rarities: ["common", "uncommon", "rare"],
    buyModifier: 1,
    sellModifier: 0.5
  },
  apothecary: {
    label: "Apothecary",
    icon: "fa-flask",
    itemOptions: ["potion", "consumable", "loot"],
    rarities: ["common", "uncommon", "rare"],
    buyModifier: 1.05,
    sellModifier: 0.5
  },
  magic: {
    label: "Magic Shop",
    icon: "fa-wand-sparkles",
    itemOptions: ["weapon", "armor", "equipment", "potion", "spellScroll", "artisanTool", "tool"],
    rarities: ["uncommon", "rare", "veryrare", "legendary"],
    buyModifier: 1.15,
    sellModifier: 0.55
  },
  temple: {
    label: "Temple / Healer",
    icon: "fa-hands-praying",
    itemOptions: ["potion", "spellScroll", "equipment"],
    rarities: ["common", "uncommon", "rare"],
    buyModifier: 1,
    sellModifier: 0.45
  },
  arcane: {
    label: "Arcane Supplier",
    icon: "fa-book-sparkles",
    itemOptions: ["spellScroll", "potion", "equipment", "artisanTool", "tool"],
    rarities: ["common", "uncommon", "rare", "veryrare"],
    buyModifier: 1.1,
    sellModifier: 0.5
  },
  adventuring: {
    label: "Adventuring Gear",
    icon: "fa-backpack",
    itemOptions: ["equipment", "artisanTool", "tool", "container", "consumable"],
    rarities: ["common", "uncommon"],
    buyModifier: 1,
    sellModifier: 0.45
  },
  tavern: {
    label: "Tavern / Provisioner",
    icon: "fa-mug-hot",
    itemOptions: ["potion", "consumable", "loot"],
    rarities: ["common"],
    buyModifier: 1,
    sellModifier: 0.35
  },
  exotic: {
    label: "Exotic Goods",
    icon: "fa-gem",
    itemOptions: ["weapon", "armor", "equipment", "potion", "spellScroll", "consumable", "artisanTool", "tool", "loot"],
    rarities: ["uncommon", "rare", "veryrare", "legendary"],
    buyModifier: 1.25,
    sellModifier: 0.6
  },
  custom: {
    label: "Custom",
    icon: "fa-sliders",
    itemOptions: [],
    rarities: [],
    buyModifier: 1,
    sellModifier: 0.5
  }
};

export const REPUTATION_TIERS = [
  { key: "hostile", label: "Hostile", buyModifier: null, sellModifier: null },
  { key: "unfriendly", label: "Unfriendly", buyModifier: 1.25, sellModifier: 0.7 },
  { key: "neutral", label: "Neutral", buyModifier: 1, sellModifier: 1 },
  { key: "friendly", label: "Friendly", buyModifier: 0.9, sellModifier: 1.2 },
  { key: "honored", label: "Honored", buyModifier: 0.8, sellModifier: 1.4 }
];

export class ShopProfileModel {
  static create({ name, type = "general" } = {}) {
    const preset = SHOP_TYPES[type] ?? SHOP_TYPES.general;
    const id = foundry.utils.randomID();

    return {
      id,
      revision: 1,
      name: name?.trim() || preset.label,
      type,
      icon: preset.icon,
      img: "icons/svg/house.svg",
      compendiums: [],
      itemOptions: [...preset.itemOptions],
      itemTypes: getItemTypesForOptions(preset.itemOptions),
      rarities: [...preset.rarities],
      categories: [],
      buyModifier: preset.buyModifier,
      sellModifier: preset.sellModifier,
      reputation: "neutral",
      inventoryMode: "hybrid",
      stock: {},
      prefabId: null,
      prefabSource: null,
      prefabItemUuids: [],
      randomInventory: {
        enabled: true,
        counts: { common: 6, uncommon: 3, rare: 1, veryrare: 0, legendary: 0 },
        allowDuplicates: false
      },
      restock: {
        rule: "manual",
        behavior: "replace",
        lastRestockedAt: 0
      },
      allowBuying: true,
      allowSelling: true,
      actorUuid: null,
      tokenUuids: []
    };
  }
}
