import { MODULE_ID } from "../constants.js";
import { CompendiumService } from "./compendium-service.js";

export class PrefabShopService {
  static definitions = null;
  static resolvedCache = new Map();

  static async getDefinitions() {
    if (this.definitions) return this.definitions;

    const response = await fetch(
      `modules/${MODULE_ID}/data/shop-prefabs.json`,
      { cache: "no-cache" }
    );

    if (!response.ok) {
      throw new Error(
        `Unable to load Marketplace prefab shops (${response.status}).`
      );
    }

    const data = await response.json();
    this.definitions = Array.isArray(data?.shops) ? data.shops : [];
    return this.definitions;
  }

  static clearCache() {
    this.resolvedCache.clear();
  }

  static normalizeName(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’‘`]/g, "'")
      .replace(/&/g, " and ")
      .toLowerCase()
      .replace(/\((?:\s*\d[\d,\s]*|bag of \d+)\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  static tokenSignature(value) {
    const stopWords = new Set(["a", "an", "of", "the"]);
    return this.normalizeName(value)
      .split(" ")
      .filter(token => token && !stopWords.has(token))
      .sort()
      .join("|");
  }

  static isSupportedOfficialPack(pack) {
    if (!pack || pack.documentName !== "Item") return false;

    const metadata = pack.metadata ?? {};
    const haystack = [
      pack.collection,
      metadata.label,
      metadata.name,
      metadata.packageName,
      metadata.packageType
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/[’‘`]/g, "'");

    return (
      haystack.includes("player's handbook") ||
      haystack.includes("players handbook") ||
      haystack.includes("dnd-players-handbook") ||
      haystack.includes("dungeon master's guide") ||
      haystack.includes("dungeon masters guide") ||
      haystack.includes("dnd-dungeon-masters-guide") ||
      haystack.includes("srd 5.1") ||
      haystack.includes("srd 5.2") ||
      haystack.includes("srd5.1") ||
      haystack.includes("srd5.2") ||
      haystack.includes("srd-5-1") ||
      haystack.includes("srd-5-2") ||
      haystack.includes("srd51") ||
      haystack.includes("srd52") ||
      pack.collection === "dnd5e.items"
    );
  }

  static getSourcePacks() {
    const allowedPackIds = CompendiumService.getAllowedPackIds();

    return allowedPackIds
      .map(packId => game.packs.get(packId))
      .filter(pack => this.isSupportedOfficialPack(pack));
  }

  static packPriority(pack) {
    const text = [
      pack?.collection,
      pack?.metadata?.label,
      pack?.metadata?.packageName
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (
      text.includes("player's handbook") ||
      text.includes("players handbook") ||
      text.includes("dnd-players-handbook")
    ) return 0;

    if (
      text.includes("dungeon master's guide") ||
      text.includes("dungeon masters guide") ||
      text.includes("dnd-dungeon-masters-guide")
    ) return 1;

    if (text.includes("5.2") || text.includes("5-2") || text.includes("52")) {
      return 2;
    }

    return 3;
  }

  static async buildItemLookup() {
    const packs = this.getSourcePacks();
    const packSignature = packs
      .map(pack => pack.collection)
      .sort()
      .join("|");

    const cacheKey = `lookup:${packSignature}`;
    if (this.resolvedCache.has(cacheKey)) {
      return this.resolvedCache.get(cacheKey);
    }

    const exact = new Map();
    const signatures = new Map();

    const sortedPacks = [...packs].sort(
      (a, b) => this.packPriority(a) - this.packPriority(b)
    );

    for (const pack of sortedPacks) {
      const index = await pack.getIndex({
        fields: ["name", "img"]
      });

      for (const entry of index) {
        const item = {
          packId: pack.collection,
          documentId: entry._id,
          uuid: `Compendium.${pack.collection}.Item.${entry._id}`,
          name: entry.name,
          img: entry.img
        };

        const normalized = this.normalizeName(entry.name);
        if (normalized && !exact.has(normalized)) {
          exact.set(normalized, item);
        }

        const signature = this.tokenSignature(entry.name);
        if (signature && !signatures.has(signature)) {
          signatures.set(signature, item);
        }
      }
    }

    const lookup = {
      packs: sortedPacks,
      packSignature,
      exact,
      signatures
    };

    this.resolvedCache.set(cacheKey, lookup);
    return lookup;
  }

  static findMatch(itemName, lookup) {
    const normalized = this.normalizeName(itemName);
    if (!normalized) return null;

    const exact = lookup.exact.get(normalized);
    if (exact) return exact;

    const signature = this.tokenSignature(itemName);
    return signature ? (lookup.signatures.get(signature) ?? null) : null;
  }

  static async resolveDefinition(definition) {
    const lookup = await this.buildItemLookup();
    const cacheKey =
      `prefab:${lookup.packSignature}:${definition.id}`;

    if (this.resolvedCache.has(cacheKey)) {
      return this.resolvedCache.get(cacheKey);
    }

    const matches = [];
    const matchedUuids = new Set();

    for (const itemName of definition.itemNames ?? []) {
      const match = this.findMatch(itemName, lookup);
      if (!match || matchedUuids.has(match.uuid)) continue;

      matchedUuids.add(match.uuid);
      matches.push({
        ...match,
        sourceItemName: itemName
      });
    }

    const result = {
      ...definition,
      matchedCount: matches.length,
      totalItems: definition.itemNames?.length ?? 0,
      matches
    };

    this.resolvedCache.set(cacheKey, result);
    return result;
  }

  static async getAvailablePrefabs({ minimumMatches = 8 } = {}) {
    const definitions = await this.getDefinitions();
    const resolved = await Promise.all(
      definitions.map(definition => this.resolveDefinition(definition))
    );

    return resolved
      .filter(prefab => prefab.matchedCount >= minimumMatches)
      .sort((a, b) => {
        const count = b.matchedCount - a.matchedCount;
        return count || a.name.localeCompare(b.name);
      });
  }

  static async getPrefab(prefabId) {
    const definitions = await this.getDefinitions();
    const definition = definitions.find(
      entry => entry.id === prefabId
    );

    return definition
      ? this.resolveDefinition(definition)
      : null;
  }
}
