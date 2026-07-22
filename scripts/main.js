import { MODULE_ID } from "./constants.js";
import { registerSettings } from "./settings.js";
import { MorelordMarketplaceApp } from "./apps/marketplace-app.js";
// import { MorelordMarketplaceSettingsApp } from "./apps/marketplace-settings-app.js";
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

Hooks.once("ready", () => {
  Logger.log("Ready");

  game.modules.get(MODULE_ID).api = {
    openMarketplace: () => new MorelordMarketplaceApp().render(true),
    openSettings: () => {
      if (!game.user.isGM) return;
      new MorelordMarketplaceSettingsApp().render(true);
    }
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
  if (actor.id === game.user.character?.id) {
    MorelordMarketplaceApp.refreshForActor(actor);
  }
});

Hooks.on("createItem", item => {
  const actor = item.parent;
  if (actor?.id === game.user.character?.id) {
    MorelordMarketplaceApp.refreshForActor(actor);
  }
});

Hooks.on("updateItem", item => {
  const actor = item.parent;
  if (actor?.id === game.user.character?.id) {
    MorelordMarketplaceApp.refreshForActor(actor);
  }
});

Hooks.on("deleteItem", item => {
  const actor = item.parent;
  if (actor?.id === game.user.character?.id) {
    MorelordMarketplaceApp.refreshForActor(actor);
  }
});