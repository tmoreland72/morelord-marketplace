import { MODULE_ID } from "../constants.js";
import { CompendiumService } from "../services/compendium-service.js";
import { MorelordMarketplaceApp } from "./marketplace-app.js";
import { EntitlementService } from "../services/entitlement-service.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MorelordMarketplaceSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "morelord-marketplace-settings",
    classes: ["morelord-marketplace", "morelord-marketplace-settings"],
    tag: "section",
    window: {
      title: "Morelord Marketplace Settings",
      icon: "fa-solid fa-gears",
      resizable: true
    },
    position: {
      width: 800,
      height: 700
    },
    actions: {
      save: MorelordMarketplaceSettingsApp.save,
      selectAll: MorelordMarketplaceSettingsApp.selectAll,
      selectNone: MorelordMarketplaceSettingsApp.selectNone,
      manageAccount: MorelordMarketplaceSettingsApp.manageAccount,
      refreshAccess: MorelordMarketplaceSettingsApp.refreshAccess
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/marketplace-settings.hbs`
    }
  };

  async _prepareContext(options) {
    const selected = game.settings.get(MODULE_ID, "allowedCompendiums") ?? [];

    const packs = game.packs
      .filter(p => p.metadata.type === "Item")
      .map(p => ({
        collection: p.collection,
        label: CompendiumService.getPackSourceLabel(p),
        packageName: p.metadata.packageName ?? "",
        selected: selected.includes(p.collection)
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const premium = EntitlementService.status();

    return {
      packs,
      premium: {
        ...premium,
        tierLabel: premium.tier === "champion"
          ? "Tools Champion"
          : premium.tier === "premium"
            ? "Tools Premium"
            : "Standard",
        validatedAtLabel: premium.validatedAt
          ? new Date(premium.validatedAt).toLocaleString()
          : null
      }
    };
  }

  static manageAccount(event) {
    event.preventDefault();
    EntitlementService.openAccount();
  }

  static async refreshAccess(event, target) {
    event.preventDefault();
    target.disabled = true;

    try {
      await EntitlementService.refresh({ quiet: false });
      this.render({ force: true });
    } finally {
      target.disabled = false;
    }
  }

  static async save(event, target) {
    event.preventDefault();

    const checked = Array.from(
      this.element.querySelectorAll("input[name='compendium']:checked")
    ).map(input => input.value);

    await game.settings.set(MODULE_ID, "allowedCompendiums", checked);

    CompendiumService.clearCache?.();

    for (const app of MorelordMarketplaceApp.instances) {
      app.render();
    }

    ui.notifications.info("Morelord Marketplace compendiums saved.");
    await this.close();
  }

  static async selectAll(event, target) {
    for (const input of this.element.querySelectorAll("input[name='compendium']")) {
      input.checked = true;
    }
  }

  static async selectNone(event, target) {
    for (const input of this.element.querySelectorAll("input[name='compendium']")) {
      input.checked = false;
    }
  }
}
