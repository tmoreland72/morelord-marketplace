import { MODULE_ID, DEFAULT_SELL_RATE } from "./constants.js";
import { MorelordMarketplaceSettingsApp } from "./apps/marketplace-settings-app.js";
import { CompendiumService } from "./services/compendium-service.js";
import { Logger } from "./logger.js";

export function registerSettings() {
  game.settings.registerMenu(MODULE_ID, "marketplaceConfiguration", {
    name: "Marketplace Configuration",
    label: "Configure Marketplace",
    hint: "Configure Marketplace trading behavior.",
    icon: "fa-solid fa-store",
    type: MorelordMarketplaceSettingsApp,
    restricted: true
  });

  game.settings.register(MODULE_ID, "sellRate", {
    name: "Default Sell Rate",
    hint: "Percentage of list price received when selling items. Use 1 for 100% or 0.5 for 50%.",
    scope: "world",
    config: false,
    type: Number,
    default: DEFAULT_SELL_RATE
  });

  game.settings.register(MODULE_ID, "enableSelling", {
    name: "Enable Global Marketplace Selling",
    hint: "Allow selling through the unrestricted global Marketplace. Shop selling is controlled by each shop and is not affected by this setting.",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "enableBuying", {
    name: "Enable Global Marketplace Buying",
    hint: "Allow buying through the unrestricted global Marketplace. When disabled, players may still browse the global catalog as a lookup tool. Shop buying is controlled by each shop and is not affected by this setting.",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "requireSellApproval", {
    name: "Require GM Approval for Sales",
    hint: "Player sales remain pending until a Game Master approves or denies each transaction.",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "requireBuyApproval", {
    name: "Require GM Approval for Purchases",
    hint: "Player purchases remain pending until a Game Master approves or denies each transaction.",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "postTransactionCards", {
    name: "Post Transaction Cards",
    hint: "Post completed and pending Marketplace transactions to chat.",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
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
}

export async function initializeMarketplaceSources() {
  if (!game.user.isGM) return;
  CompendiumService.clearCache();
  Logger.log("Marketplace sources synchronized with D&D5e Configure Sources.");
}
