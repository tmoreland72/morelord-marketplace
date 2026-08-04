import { MODULE_ID, DEFAULT_SELL_RATE } from "./constants.js";
import { MorelordMarketplaceSettingsApp } from "./apps/marketplace-settings-app.js";
import { CompendiumService } from "./services/compendium-service.js";
import { Logger } from "./logger.js";

const DEFAULT_COMPENDIUM_LABEL_TERMS = ["item", "equipment"];

export function registerSettings() {
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

  game.settings.register(MODULE_ID, "defaultCompendiumsInitialized", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
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

export async function initializeDefaultCompendiums() {
  if (!game.user.isGM) return;

  const initialized = game.settings.get(
    MODULE_ID,
    "defaultCompendiumsInitialized"
  );

  if (initialized) return;

  const existingPackIds = game.settings.get(
    MODULE_ID,
    "allowedCompendiums"
  ) ?? [];

  // Preserve any compendium choices already made in an existing world.
  if (existingPackIds.length > 0) {
    await game.settings.set(
      MODULE_ID,
      "defaultCompendiumsInitialized",
      true
    );

    Logger.log(
      "Existing marketplace compendium selection preserved",
      existingPackIds
    );
    return;
  }

  const defaultPackIds = game.packs
    .filter(pack => {
      const documentName = String(
        pack.documentName ??
        pack.metadata?.type ??
        ""
      ).toLowerCase();

      if (documentName !== "item") return false;

      const label = String(
        pack.metadata?.label ??
        pack.title ??
        pack.collection ??
        ""
      ).toLowerCase();

      return DEFAULT_COMPENDIUM_LABEL_TERMS.some(term =>
        label.includes(term)
      );
    })
    .map(pack => pack.collection);

  await game.settings.set(
    MODULE_ID,
    "allowedCompendiums",
    defaultPackIds
  );

  await game.settings.set(
    MODULE_ID,
    "defaultCompendiumsInitialized",
    true
  );

  CompendiumService.clearCache?.();

  Logger.log(
    "Initialized default marketplace compendiums",
    defaultPackIds
  );
}
