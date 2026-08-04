import { MODULE_ID } from "./constants.js";
import {
  registerSettings,
  initializeDefaultCompendiums
} from "./settings.js";
import { MorelordMarketplaceApp } from "./apps/marketplace-app.js";
import { Logger } from "./logger.js";

Logger.log("main.js loaded");

Hooks.once("init", async () => {
  Logger.log("Initializing");

  registerSettings();

  await foundry.applications.handlebars.loadTemplates([
    `modules/${MODULE_ID}/templates/parts/buy-tab.hbs`,
    `modules/${MODULE_ID}/templates/parts/sell-tab.hbs`,
    `modules/${MODULE_ID}/templates/marketplace-settings.hbs`
  ]);

  Logger.log("Templates loaded");
});

Hooks.once("ready", async () => {
  Logger.log("Ready");

  await initializeDefaultCompendiums();

  game.modules.get(MODULE_ID).api = {
    openMarketplace: () => new MorelordMarketplaceApp().render(true)
  };

  Logger.log("API registered");
});

Hooks.on("getSceneControlButtons", controls => {
  const tokenControls = controls.tokens;
  if (!tokenControls) return;

  tokenControls.tools.morelordMarketplace = {
    name: "morelordMarketplace",
    title: "Morelord Marketplace",
    icon: "fa-solid fa-store",
    order: Object.keys(tokenControls.tools).length,
    button: true,
    visible: true,
    onChange: () => new MorelordMarketplaceApp().render(true)
  };
});

Hooks.on("updateActor", actor => {
  MorelordMarketplaceApp.refreshForActor(actor);
});

Hooks.on("createItem", item => {
  if (item.parent) {
    MorelordMarketplaceApp.refreshForActor(item.parent);
  }
});

Hooks.on("updateItem", item => {
  if (item.parent) {
    MorelordMarketplaceApp.refreshForActor(item.parent);
  }
});

Hooks.on("deleteItem", item => {
  if (item.parent) {
    MorelordMarketplaceApp.refreshForActor(item.parent);
  }
});
