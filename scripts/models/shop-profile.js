export class ShopProfileModel {
  constructor({
    id,
    name,
    compendiums = [],
    itemTypes = [],
    rarities = [],
    categories = [],
    priceModifier = 1,
    availabilityModifier = 0,
    tags = []
  }) {
    this.id = id;
    this.name = name;
    this.compendiums = compendiums;
    this.itemTypes = itemTypes;
    this.rarities = rarities;
    this.categories = categories;
    this.priceModifier = priceModifier;
    this.availabilityModifier = availabilityModifier;
    this.tags = tags;
  }
}

/**
 Example shop profile:    
 {
  id: "phandalin-blacksmith",
  name: "Phandalin Blacksmith",
  compendiums: ["dnd5e.items"],
  itemTypes: ["weapon", "equipment"],
  categories: ["armor", "weapon"],
  rarities: ["common"],
  priceModifier: 1.1
}
 */