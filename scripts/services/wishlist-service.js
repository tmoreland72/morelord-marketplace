import { MODULE_ID, FLAGS } from "../constants.js";

export class WishlistService {
  static getEntries(actor) {
    const entries = actor?.getFlag?.(MODULE_ID, FLAGS.WISHLIST);
    return Array.isArray(entries) ? entries.filter(entry => entry?.uuid) : [];
  }

  static getUuids({ allActors = false, actor = null } = {}) {
    const actors = allActors ? [...(game.actors ?? [])] : [actor];
    return new Set(actors.flatMap(entry => this.getEntries(entry).map(wish => wish.uuid)));
  }

  static has(row, actor) {
    return Boolean(row?.uuid && this.getEntries(actor).some(entry => entry.uuid === row.uuid));
  }

  static async add(row, actor) {
    if (!row?.uuid || !actor) return false;
    const entries = this.getEntries(actor);
    if (entries.some(entry => entry.uuid === row.uuid)) return false;

    await actor.setFlag(MODULE_ID, FLAGS.WISHLIST, [...entries, {
      uuid: row.uuid,
      packId: row.packId,
      documentId: row.documentId,
      name: row.name,
      img: row.img,
      typeLabel: row.typeLabel,
      subtypeLabel: row.subtypeLabel,
      rarityLabel: row.rarityLabel,
      buyPrice: row.buyPrice,
      buyPriceCp: row.buyPriceCp,
      source: row.source,
      addedAt: Date.now()
    }]);
    return true;
  }

  static async remove(uuid, actor) {
    if (!uuid || !actor) return false;
    const entries = this.getEntries(actor);
    const next = entries.filter(entry => entry.uuid !== uuid);
    if (next.length === entries.length) return false;
    await actor.setFlag(MODULE_ID, FLAGS.WISHLIST, next);
    return true;
  }
}
