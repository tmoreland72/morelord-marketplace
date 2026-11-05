/** Use the system's import preparation so container contents get fresh, linked IDs. */
export async function preparePurchaseItems(items) {
  const ItemClass = globalThis.CONFIG?.Item?.documentClass;
  if (typeof ItemClass?.createWithContents === "function") return ItemClass.createWithContents(items);
  return items.map(item => {
    const data = item.toObject();
    delete data._id;
    return data;
  });
}

function actorItems(actor) {
  const items = actor?.items;
  if (!items) return [];
  if (typeof items.values === "function" && typeof items[Symbol.iterator] !== "function") return [...items.values()];
  return [...items];
}

function sourceValues(item) {
  const values = [
    item?.uuid,
    item?._stats?.compendiumSource,
    item?.flags?.core?.sourceId,
    item?.getFlag?.("core", "sourceId")
  ];
  return new Set(values.filter(Boolean).map(String));
}

function ownedSources(item) {
  return [
    item?._stats?.compendiumSource,
    item?.flags?.core?.sourceId,
    item?.getFlag?.("core", "sourceId")
  ].filter(Boolean).map(String);
}

function matchesPurchasedStack(owned, item) {
  if (!owned || owned.type !== item?.type) return false;
  if (owned.system?.container) return false;
  const sources = sourceValues(item);
  if (!sources.size) return false;
  return ownedSources(owned).some(value => sources.has(value));
}

function withQuantity(data, quantity) {
  return { ...data, system: { ...(data.system ?? {}), quantity } };
}

function rememberSource(data, item) {
  const identity = item?.uuid || item?._stats?.compendiumSource || item?.flags?.core?.sourceId || item?.getFlag?.("core", "sourceId");
  if (!identity) return data;
  return {
    ...data,
    flags: { ...(data.flags ?? {}), core: { ...(data.flags?.core ?? {}), sourceId: identity } },
    _stats: { ...(data._stats ?? {}), compendiumSource: data._stats?.compendiumSource || identity }
  };
}

/**
 * Grant a purchased stack or one container copy per unit.
 * `created` and `updated` are undo records: created ids are deleted, updated restores the previous quantity.
 */
export async function grantPurchasedItems(actor, item, qty) {
  const quantity = Number(qty);
  if (item?.type === "container") {
    const prepared = await preparePurchaseItems(Array.from({ length: quantity }, () => item));
    const documents = (Array.isArray(prepared) ? prepared : [prepared]).map(data => (
      data?.system?.container ? data : withQuantity(data, 1)
    ));
    const created = await actor.createEmbeddedDocuments("Item", documents, { keepId: true });
    const root = created.find(document => !document?.system?.container) ?? created[0];
    return { created: created.map(document => document.id), updated: [], uuid: root?.uuid ?? null };
  }

  const existing = actorItems(actor).find(owned => matchesPurchasedStack(owned, item));
  if (existing) {
    const previous = Number(existing.system?.quantity ?? 0);
    const next = previous + quantity;
    if (typeof existing.update === "function") await existing.update({ "system.quantity": next });
    else await actor.updateEmbeddedDocuments("Item", [{ _id: existing.id, "system.quantity": next }]);
    return { created: [], updated: [{ id: existing.id, quantity: previous }], uuid: existing.uuid ?? null };
  }

  const prepared = await preparePurchaseItems([item]);
  const root = (Array.isArray(prepared) ? prepared : [prepared]).find(data => !data?.system?.container) ?? prepared[0];
  const document = rememberSource(withQuantity(root, quantity), item);
  const created = await actor.createEmbeddedDocuments("Item", [document], { keepId: true });
  return { created: created.map(entry => entry.id), updated: [], uuid: created[0]?.uuid ?? null };
}

/** Reverse grants. Later quantity updates are restored first so a stack merged twice returns to its original quantity. */
export async function undoPurchasedItems(actor, grants) {
  const list = Array.isArray(grants) ? grants : [grants];
  const created = list.flatMap(grant => grant?.created ?? []);
  const updated = list.flatMap(grant => grant?.updated ?? []).reverse();
  if (created.length) await actor.deleteEmbeddedDocuments("Item", created);
  for (const entry of updated) {
    const item = actorItems(actor).find(candidate => candidate.id === entry.id);
    if (typeof item?.update === "function") await item.update({ "system.quantity": entry.quantity });
    else await actor.updateEmbeddedDocuments("Item", [{ _id: entry.id, "system.quantity": entry.quantity }]);
  }
}
