import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addMorelordTool } from "../scripts/scene-tools.js";

function installHooks() {
  const once = new Map();
  const on = new Map();
  globalThis.Hooks = {
    once(event, callback) {
      const list = once.get(event) ?? [];
      list.push(callback);
      once.set(event, list);
    },
    on(event, callback) {
      const list = on.get(event) ?? [];
      list.push(callback);
      on.set(event, list);
    }
  };

  return {
    async setup() {
      const callbacks = [...(once.get("setup") ?? [])];
      once.set("setup", []);
      for (const callback of callbacks) await callback();
    },
    sceneControls(controls) {
      for (const callback of on.get("getSceneControlButtons") ?? []) callback(controls);
    },
    sceneHookCount() {
      return (on.get("getSceneControlButtons") ?? []).length;
    }
  };
}

function restoreGlobals() {
  delete globalThis.game;
  delete globalThis.Hooks;
}

test("Core 0.6.0 registry receives the tool and skips the Token palette", async () => {
  const hooks = installHooks();
  const registered = [];
  globalThis.game = {
    modules: {
      get: id => id === "morelord-core"
        ? { api: { tools: { register: definition => registered.push(definition) } } }
        : undefined
    }
  };
  const definition = {
    id: "morelord-marketplace",
    title: "Morelord Marketplace",
    icon: "fa-solid fa-store",
    order: 50,
    visible: () => true,
    onClick: () => "open"
  };

  addMorelordTool(definition);
  await hooks.setup();

  assert.deepEqual(registered, [definition]);
  assert.equal(hooks.sceneHookCount(), 0);
  const controls = { tokens: { tools: { select: { name: "select" } } } };
  hooks.sceneControls(controls);
  assert.deepEqual(Object.keys(controls.tokens.tools), ["select"]);
  restoreGlobals();
});

test("older Core keeps Token-palette buttons, keys, and GM visibility", async () => {
  const hooks = installHooks();
  globalThis.game = {
    modules: { get: () => ({ api: {} }) },
    user: { isGM: true }
  };
  let clicks = 0;
  addMorelordTool({
    id: "morelord-marketplace",
    title: "Morelord Marketplace",
    icon: "fa-solid fa-store",
    order: 50,
    visible: () => true,
    onClick: () => { clicks += 1; }
  });
  addMorelordTool({
    id: "morelord-marketplace-shops",
    title: "Manage Marketplace Shops",
    icon: "fa-solid fa-shop",
    order: 51,
    visible: () => game.user.isGM,
    onClick: () => { clicks += 10; }
  });
  await hooks.setup();
  await hooks.setup();

  const controls = { tokens: { tools: { select: { name: "select" } } } };
  hooks.sceneControls(controls);
  const marketplace = controls.tokens.tools.morelordMarketplace;
  const shops = controls.tokens.tools.morelordMarketplaceShops;
  assert.equal(marketplace.name, "morelordMarketplace");
  assert.equal(marketplace.title, "Morelord Marketplace");
  assert.equal(marketplace.icon, "fa-solid fa-store");
  assert.equal(marketplace.button, true);
  assert.equal(marketplace.visible, true);
  assert.equal(marketplace.order, 1);
  assert.equal(shops.name, "morelordMarketplaceShops");
  assert.equal(shops.title, "Manage Marketplace Shops");
  assert.equal(shops.icon, "fa-solid fa-shop");
  assert.equal(shops.order, 2);
  marketplace.onChange();
  shops.onChange();
  assert.equal(clicks, 11);

  game.user.isGM = false;
  const playerControls = { tokens: { tools: { select: { name: "select" } } } };
  hooks.sceneControls(playerControls);
  assert.equal(playerControls.tokens.tools.morelordMarketplace.title, "Morelord Marketplace");
  assert.equal(playerControls.tokens.tools.morelordMarketplaceShops, undefined);
  hooks.sceneControls({});
  assert.equal(hooks.sceneHookCount(), 2);
  restoreGlobals();
});

test("a missing Core module uses the Token-palette fallback", async () => {
  const hooks = installHooks();
  globalThis.game = { modules: { get: () => undefined }, user: { isGM: true } };
  addMorelordTool({
    id: "morelord-craftworks",
    title: "Morelord Craftworks",
    icon: "fa-solid fa-hammer",
    order: 30,
    visible: () => true,
    onClick() {}
  });
  await hooks.setup();
  const controls = { tokens: { tools: {} } };
  hooks.sceneControls(controls);
  assert.equal(controls.tokens.tools.morelordCraftworks.icon, "fa-solid fa-hammer");
  assert.equal(controls.tokens.tools.morelordCraftworks.order, 0);
  restoreGlobals();
});

test("Marketplace registers both tools and keeps the shop-token HUD button", () => {
  const source = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
  assert.equal(source.includes("getSceneControlButtons"), false);
  assert.equal(source.includes("tokenControls.tools"), false);
  assert.match(source, /addMorelordTool\(\{\s*id: "morelord-marketplace",\s*title: "Morelord Marketplace",\s*icon: "fa-solid fa-store",\s*order: 50,\s*visible: \(\) => true,\s*onClick: \(\) => new MorelordMarketplaceApp\(\)\.render\(true\)/s);
  assert.match(source, /addMorelordTool\(\{\s*id: "morelord-marketplace-shops",\s*title: "Manage Marketplace Shops",\s*icon: "fa-solid fa-shop",\s*order: 51,\s*visible: \(\) => game\.user\.isGM,/s);
  assert.match(source, /EntitlementService\.refresh\(\{ quiet: true \}\)/);
  assert.match(source, /Shop Manager requires Marketplace Premium or Champion access\./);
  assert.match(source, /new MorelordShopManagerApp\(\)\.render\(true\)/);
  assert.match(source, /Hooks\.on\("renderTokenHUD"/);
  assert.equal(manifest.version, "0.12.0");
  const core = manifest.relationships.requires.find(requirement => requirement.id === "morelord-core");
  assert.equal(core.compatibility.minimum, "0.9.0");
  assert.match(source, /api\?\.ui\?\.renderInBackground/);
  assert.match(source, /return app\.render\(\{ force: false \}\)/);
  assert.equal(source.includes("app.render({ force: true })"), false);
});
