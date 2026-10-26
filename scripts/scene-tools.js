/**
 * Register one Morelord scene tool.
 *
 * Core 0.6.0 exposes `api.tools` during init. This helper registers there on
 * setup. When that registry is missing (Core older than 0.6.0), it adds the
 * same button to the Token control palette.
 */
export function addMorelordTool(definition) {
  Hooks.once("setup", () => {
    const tools = game.modules?.get?.("morelord-core")?.api?.tools;
    if (typeof tools?.register === "function") {
      tools.register(definition);
      return;
    }

    Hooks.on("getSceneControlButtons", controls => {
      installLegacyTokenTool(controls, definition);
    });
  });
}

function installLegacyTokenTool(controls, definition) {
  const tokenTools = controls?.tokens?.tools;
  if (!tokenTools) return;

  const key = sceneToolKey(definition.id);
  if (!toolIsVisible(definition.visible)) {
    delete tokenTools[key];
    return;
  }

  const order = Object.keys(tokenTools).filter(name => name !== key).length;
  tokenTools[key] = {
    name: key,
    title: definition.title,
    icon: definition.icon,
    order,
    button: true,
    visible: true,
    onChange: definition.onClick
  };
}

function sceneToolKey(id) {
  const parts = String(id ?? "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!parts.length) return "tool";
  const [first, ...rest] = parts;
  const head = first.charAt(0).toLowerCase() + first.slice(1);
  const tail = rest.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  return head + tail;
}

function toolIsVisible(visible) {
  if (typeof visible === "function") return Boolean(visible());
  return visible !== false;
}
