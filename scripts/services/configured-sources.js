import { Dnd5eSourceFilterService } from "../../../morelord-core/scripts/services/dnd5e-source-filter-service.js";

/**
 * Marketplace's only compendium access gate.
 *
 * D&D 5e Configure Sources is the world setting `packSourceConfiguration`
 * (menu key `dnd5e.packSourceConfiguration`, localization
 * `DND5E.CompendiumBrowser.Sources.Name`). A compendium turned off there must
 * not be listed, indexed, purchased, previewed, or used as a fallback. Shop
 * filters may only narrow this set.
 *
 * TODO(morelord-core): Replace the interim delegation in this file with Core's
 * shared helper once that PR exports it. Expected API:
 *   import { getAllowedPacks, isUuidAllowed } from "../../../morelord-core/scripts/services/dnd5e-source-filter-service.js";
 *   MorelordCore.sources.getAllowedPacks({ documentName: "Item" })
 *   MorelordCore.sources.isUuidAllowed(uuid)
 * Do not reimplement `packSourceConfiguration` here. Until those exports
 * exist, calls delegate to the current `Dnd5eSourceFilterService`
 * (`enabledPacks`, `isPackEnabled`, `isSourceEnabled`, `sourceLabelForItem`).
 */
const sources = new Dnd5eSourceFilterService();
const COMPENDIUM_UUID = /^Compendium\.([^.]+)\.([^.]+)\.([^.]+)\.(.+)$/;

function coreSources() {
  const shared = globalThis.MorelordCore?.sources
    ?? globalThis.game?.modules?.get?.("morelord-core")?.api?.sources
    ?? null;
  if (
    typeof shared?.getAllowedPacks === "function"
    || typeof shared?.isUuidAllowed === "function"
  ) return shared;
  return null;
}

function packsFromGame() {
  const packs = globalThis.game?.packs;
  if (!packs) return [];
  if (typeof packs.values === "function") return [...packs.values()];
  return [...packs];
}

export function parseCompendiumItemUuid(uuid) {
  const match = COMPENDIUM_UUID.exec(String(uuid ?? ""));
  if (!match) return null;
  return {
    collection: `${match[1]}.${match[2]}`,
    documentName: match[3],
    documentId: match[4]
  };
}

export function sourceConfiguration() {
  if (globalThis.game?.system?.id !== "dnd5e") return {};
  try {
    return sources.configuration ?? {};
  } catch {
    return {};
  }
}

/** Item packs Configure Sources currently allows. */
export function getAllowedPacks({ documentName = "Item" } = {}) {
  const shared = coreSources();
  if (typeof shared?.getAllowedPacks === "function") {
    return [...(shared.getAllowedPacks({ documentName }) ?? [])];
  }
  // TODO(morelord-core): delete this delegation when getAllowedPacks is exported.
  if (globalThis.game?.system) return sources.enabledPacks({ documentName });
  return packsFromGame().filter(pack =>
    !documentName || !pack?.documentName || pack.documentName === documentName
  );
}

export function isPackAllowed(packOrCollection) {
  const shared = coreSources();
  const collection = typeof packOrCollection === "string"
    ? packOrCollection
    : packOrCollection?.collection;
  if (typeof shared?.getAllowedPacks === "function") {
    return getAllowedPacks().some(pack => pack.collection === collection);
  }
  // TODO(morelord-core): delete this delegation when getAllowedPacks is exported.
  if (globalThis.game?.system?.id !== "dnd5e") return true;
  return sources.isPackEnabled(packOrCollection ?? collection);
}

/**
 * Sync pack gate for stored uuids. Non-compendium uuids (owned actor items)
 * stay allowed. Document provenance is enforced by `loadAllowedItem`.
 */
export function isUuidAllowed(uuid) {
  const shared = coreSources();
  if (typeof shared?.isUuidAllowed === "function") return shared.isUuidAllowed(uuid);
  // TODO(morelord-core): delete this delegation when isUuidAllowed is exported.
  const parsed = parseCompendiumItemUuid(uuid);
  if (!parsed) return true;
  return isPackAllowed(parsed.collection);
}

/** Indexed source-book gate. Delegates to Core; does not read the setting itself. */
export function isSourceAllowed(sourceLabel, { itemType = null } = {}) {
  if (globalThis.game?.system?.id !== "dnd5e") return true;
  return sources.isSourceEnabled(sourceLabel, { itemType });
}

export async function indexAllowedPack(pack, fields) {
  if (!pack || !isPackAllowed(pack)) return [];
  return pack.getIndex({ fields });
}

/**
 * Load one Item document from an allowed pack.
 * @returns {{status: "ok", item: object} | {status: "denied" | "missing"}}
 */
export async function loadAllowedItem(packId, documentId) {
  const shared = coreSources();
  const uuid = `Compendium.${packId}.Item.${documentId}`;
  if (typeof shared?.isUuidAllowed === "function") {
    const allowed = await shared.isUuidAllowed(uuid);
    if (!allowed) return { status: "denied" };
  }

  const pack = getAllowedPacks().find(entry => entry?.collection === packId);
  if (!pack) return { status: "denied" };

  const item = await pack.getDocument?.(documentId);
  if (!item) return { status: "missing" };
  if (typeof shared?.isUuidAllowed === "function") return { status: "ok", item };

  // TODO(morelord-core): fold this provenance check into isUuidAllowed.
  if (globalThis.game?.system?.id === "dnd5e") {
    const label = sources.sourceLabelForItem(item, { pack });
    if (!sources.isSourceEnabled(label, { itemType: item.type })) return { status: "denied" };
  }
  return { status: "ok", item };
}
