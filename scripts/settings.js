import { MODULE_ID, DEFAULT_SELL_RATE } from "./constants.js";
import { MorelordMarketplaceSettingsApp } from "./apps/marketplace-settings-app.js";

export function registerSettings() {
  game.settings.register(MODULE_ID, "allowedCompendiums", {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.registerMenu(MODULE_ID, "marketplaceConfiguration", {
    name: "Marketplace Configuration",
    label: "Configure Marketplace",
    hint: "Select the compendiums and other options available to Morelord Marketplace.",
    icon: "fa-solid fa-store",
    type: MorelordMarketplaceSettingsApp,
    restricted: true
  });
  
  game.settings.register(MODULE_ID, "sellRate", {
    name: "Default Sell Rate",
    hint: "Percentage of list price received when selling items.",
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULT_SELL_RATE
  });

  game.settings.register(MODULE_ID, "enableSelling", {
    name: "Enable Selling",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "enableBuying", {
    name: "Enable Buying",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "allowedCompendiums", {
    name: "Allowed Compendiums",
    hint: "Compendium pack IDs players may buy from.",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, "shops", {
    name: "Shop Profiles",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, "currentShop", {
    name: "Current Shop",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "postTransactionCards", {
    name: "Post Transaction Cards",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}