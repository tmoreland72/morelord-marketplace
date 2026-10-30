import { normalizeCapabilityTier, rarityWithinCapability } from "./shop-capability.js";

export const ENABLE_LOCATIONS_SETTING = "enableLocations";

const TIER_LABELS = Object.freeze({
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  veryRare: "Very Rare",
  legendary: "Legendary"
});

/**
 * Scene id for a shopper. Another user's missing viewed scene does not use this client.
 */
export function sceneIdForUser(user, { localUserId = null, localSceneId = null } = {}) {
  if (user?.viewedScene) return String(user.viewedScene);
  if (user?.id && localUserId && String(user.id) === String(localUserId)) return localSceneId ? String(localSceneId) : null;
  return localSceneId && !user ? String(localSceneId) : null;
}

export function roadLocation() {
  return {
    id: "road",
    name: "On the Road",
    settlementType: "road",
    sceneIds: [],
    capabilities: [],
    notes: "",
    metadata: { virtual: true }
  };
}

/** Core 0.9.0 reports this virtual place for any active session that has no location. */
export function isUnplacedRoad(location, source = null) {
  if (source === "road") return true;
  return location?.id === "road" && location?.metadata?.virtual === true;
}

/**
 * Prefer Core's shared active place. A missing API keeps the local lookup.
 * A virtual On the Road result yields to the viewed scene's location when one exists,
 * so a Downtime session set to No Location does not hide that scene.
 */
export function locationFromActiveContext(locationsApi, user, fallbackLocation) {
  if (typeof locationsApi?.activeContext !== "function") return fallbackLocation ?? null;
  const context = locationsApi.activeContext(user);
  const location = context?.location ?? null;
  if (isUnplacedRoad(location, context?.source) && fallbackLocation) return fallbackLocation;
  return location;
}

/**
 * An explicit Downtime session location wins. A session with no location uses the
 * viewed scene's location. On the Road remains only when that scene has none.
 */
export function resolveTradingLocation({
  sceneLocation = null,
  downtimeState = null,
  downtimeActive = false,
  getLocation = () => null
} = {}) {
  if (!downtimeActive) return sceneLocation ?? null;
  const session = Object.values(downtimeState?.sessions ?? {}).find(entry => entry?.status === "active") ?? null;
  if (!session) return sceneLocation ?? null;
  const locationId = String(session.locationId ?? "").trim();
  if (locationId) return getLocation(locationId) ?? null;
  return sceneLocation ?? roadLocation();
}

export function normalizeTradeRarity(value) {
  if (value && typeof value === "object") value = value.value ?? value.id ?? value.key ?? "";
  const compact = String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!compact || compact === "none" || compact === "mundane") return "common";
  if (compact === "artifact") return "artifact";
  return normalizeCapabilityTier(compact) ?? "common";
}

export function tierLabel(tier) {
  return TIER_LABELS[normalizeCapabilityTier(tier)] ?? "Common";
}

export function selectMarketplaceCapability(location, meetsTier = null) {
  const matches = (location?.capabilities ?? [])
    .filter(entry => String(entry?.type ?? "").trim() === "marketplace")
    .map(entry => {
      const tier = normalizeCapabilityTier(entry?.tier);
      return tier ? { ...entry, type: "marketplace", tier } : null;
    })
    .filter(Boolean);
  return matches.reduce((best, entry) => {
    if (!best) return entry;
    const higher = typeof meetsTier === "function"
      ? meetsTier(entry.tier, best.tier) === true
      : rarityWithinCapability(best.tier, entry.tier);
    return higher ? entry : best;
  }, null);
}

function rarityAllowed(rarity, capabilityTier, meetsTier) {
  const tier = normalizeCapabilityTier(capabilityTier);
  if (!tier) return false;
  const tradeRarity = normalizeTradeRarity(rarity);
  if (typeof meetsTier === "function") return meetsTier(tier, tradeRarity) === true;
  return rarityWithinCapability(tradeRarity, tier);
}

function placeName(location) {
  return location?.name || "The current location";
}

export function evaluateLocationTrade({
  enabled = false,
  locationsAvailable = true,
  location = null,
  capability,
  rarity = "common",
  shop = null,
  shopAllowsItem = true,
  meetsTier = null
} = {}) {
  if (!enabled) return { allowed: true, code: "disabled", message: null, shortLabel: null, location, capability: null };

  if (locationsAvailable === false) {
    return {
      allowed: false,
      code: "locations-unavailable",
      message: "Morelord Locations is unavailable. Update and enable Morelord Core, or turn off Enable Locations.",
      shortLabel: "Locations unavailable",
      location,
      capability: null
    };
  }

  const resolved = capability === undefined
    ? selectMarketplaceCapability(location, meetsTier)
    : capability;
  if (!resolved?.tier) {
    const name = placeName(location);
    return {
      allowed: false,
      code: "no-marketplace",
      message: `${name} has no Marketplace, so nothing can be bought or sold here.`,
      shortLabel: "No Marketplace",
      location,
      capability: null
    };
  }

  if (shop && shopAllowsItem !== true) {
    const name = shop.name || "This shop";
    return {
      allowed: false,
      code: "shop-rules",
      message: `${name} does not trade this item.`,
      shortLabel: "Not traded here",
      location,
      capability: resolved
    };
  }

  if (shop) {
    return {
      allowed: true,
      code: "shop-override",
      message: null,
      shortLabel: null,
      location,
      capability: resolved
    };
  }

  if (!rarityAllowed(rarity, resolved.tier, meetsTier)) {
    const name = location?.name || "This location";
    return {
      allowed: false,
      code: "above-tier",
      message: `${name}'s Marketplace trades ${tierLabel(resolved.tier)} items and lower. This item is above that limit.`,
      shortLabel: "Above location limit",
      location,
      capability: resolved
    };
  }

  return {
    allowed: true,
    code: "within-tier",
    message: null,
    shortLabel: null,
    location,
    capability: resolved
  };
}

/** Global Buy omits rows above the location tier. A shop's own catalog is left intact. */
export function filterBuyCatalog(rows = [], {
  enabled = false,
  locationsAvailable = true,
  location = null,
  capability,
  shop = null,
  meetsTier = null
} = {}) {
  if (!enabled) return rows;
  const presence = evaluateLocationTrade({
    enabled: true,
    locationsAvailable,
    location,
    capability,
    rarity: "common",
    shop,
    shopAllowsItem: true,
    meetsTier
  });
  if (!presence.allowed) return [];
  if (shop) return rows;
  return rows.filter(row => evaluateLocationTrade({
    enabled: true,
    locationsAvailable,
    location,
    capability,
    rarity: row?.rarityKey ?? row?.rarity,
    meetsTier
  }).allowed);
}

/** Sell keeps every owned row. Items above the tier stay listed with selling disabled. */
export function sellLocationState(rarity, {
  enabled = false,
  locationsAvailable = true,
  location = null,
  capability,
  shop = null,
  meetsTier = null
} = {}) {
  const decision = evaluateLocationTrade({
    enabled,
    locationsAvailable,
    location,
    capability,
    rarity,
    shop,
    shopAllowsItem: true,
    meetsTier
  });
  return {
    listed: true,
    canSell: decision.allowed,
    reason: decision.allowed ? null : decision.message
  };
}

export function describeLocationTrade({
  enabled = false,
  locationsAvailable = true,
  location = null,
  capability,
  shop = null,
  meetsTier = null
} = {}) {
  if (!enabled) {
    return { enabled: false, canTrade: true, tone: null, title: null, message: null, tier: null, icon: null };
  }
  const decision = evaluateLocationTrade({
    enabled: true,
    locationsAvailable,
    location,
    capability,
    rarity: "common",
    shop,
    shopAllowsItem: true,
    meetsTier
  });
  if (!decision.allowed) {
    return {
      enabled: true,
      canTrade: false,
      tone: "warning",
      icon: "fa-solid fa-triangle-exclamation",
      title: decision.code === "locations-unavailable" ? "Locations unavailable" : "No Marketplace here",
      message: decision.message,
      tier: null
    };
  }
  const tier = decision.capability?.tier ?? null;
  const place = location?.name || "This location";
  const label = tierLabel(tier);
  if (shop) {
    return {
      enabled: true,
      canTrade: true,
      tone: "info",
      icon: "fa-solid fa-location-dot",
      title: "Shop stock overrides this location",
      message: `${shop.name || "This shop"} follows its own stock and purchase rules. ${place}'s ${label} Marketplace does not remove items this shop trades.`,
      tier
    };
  }
  return {
    enabled: true,
    canTrade: true,
    tone: "warning",
    icon: "fa-solid fa-triangle-exclamation",
    title: "Location Marketplace",
    message: `${place}'s Marketplace trades ${label} items and lower.`,
    tier
  };
}

export class LocationTradeService {
  static locationApi() {
    return globalThis.game?.modules?.get?.("morelord-core")?.api?.locations
      ?? globalThis.MorelordCore?.locations
      ?? null;
  }

  static enabled() {
    try {
      return globalThis.game?.settings?.get?.("morelord-marketplace", ENABLE_LOCATIONS_SETTING) === true;
    } catch {
      return false;
    }
  }

  static downtimeContext() {
    const downtime = globalThis.game?.modules?.get?.("morelord-downtime");
    if (!downtime?.active) return { active: false, state: null };
    try {
      return { active: true, state: globalThis.game.settings.get("morelord-downtime", "projectState") };
    } catch {
      return { active: false, state: null };
    }
  }

  static currentLocation(user = globalThis.game?.user) {
    const api = this.locationApi();
    if (typeof api?.activeContext === "function") {
      return locationFromActiveContext(api, user, this.sceneLocation(user));
    }
    return this.fallbackLocation(user);
  }

  static sceneLocation(user = globalThis.game?.user) {
    const api = this.locationApi();
    const localSceneId = globalThis.canvas?.scene?.id ?? globalThis.game?.scenes?.current?.id ?? null;
    const sceneId = sceneIdForUser(user, { localUserId: globalThis.game?.user?.id ?? null, localSceneId });
    if (typeof api?.forScene === "function" && sceneId) return api.forScene(sceneId) ?? null;
    if (typeof api?.current === "function" && (!user || user.id === globalThis.game?.user?.id)) return api.current() ?? null;
    return null;
  }

  static fallbackLocation(user = globalThis.game?.user) {
    const api = this.locationApi();
    const downtime = this.downtimeContext();
    return resolveTradingLocation({
      sceneLocation: this.sceneLocation(user),
      downtimeState: downtime.state,
      downtimeActive: downtime.active,
      getLocation: id => (typeof api?.get === "function" ? api.get(id) : null)
    });
  }

  static capabilityFor(location) {
    const api = this.locationApi();
    const meetsTier = typeof api?.meetsTier === "function" ? api.meetsTier : null;
    if (typeof api?.evaluateRequirements === "function") {
      try {
        const evaluation = api.evaluateRequirements(
          [{ kind: "capability", type: "marketplace", tier: "common" }],
          { location }
        );
        const result = evaluation?.results?.find(entry => entry?.kind === "capability");
        const tier = result?.passed ? normalizeCapabilityTier(result.actual?.tier) : null;
        if (tier) return { type: "marketplace", tier, specialty: result.actual?.specialty ?? null };
        return null;
      } catch {
        return selectMarketplaceCapability(location, meetsTier);
      }
    }
    return selectMarketplaceCapability(location, meetsTier);
  }

  static decide({
    shop = null,
    rarity = "common",
    shopAllowsItem = true,
    location,
    capability,
    user
  } = {}) {
    const enabled = this.enabled();
    const api = this.locationApi();
    const locationsAvailable = Boolean(api);
    const resolvedLocation = location !== undefined ? location : (enabled ? this.currentLocation(user) : null);
    const resolvedCapability = capability !== undefined
      ? capability
      : (enabled && locationsAvailable ? this.capabilityFor(resolvedLocation) : undefined);
    return evaluateLocationTrade({
      enabled,
      locationsAvailable: enabled ? locationsAvailable : true,
      location: resolvedLocation,
      capability: resolvedCapability,
      rarity,
      shop,
      shopAllowsItem,
      meetsTier: typeof api?.meetsTier === "function" ? api.meetsTier : null
    });
  }

  static block(options = {}) {
    const decision = this.decide(options);
    return decision.allowed ? null : decision;
  }

  static deny(options = {}) {
    const blocked = this.block(options);
    if (!blocked) return null;
    const error = new Error(blocked.message);
    error.locationTrade = true;
    error.code = blocked.code;
    return error;
  }

  static filterBuyCatalog(rows, { shop = null } = {}) {
    const enabled = this.enabled();
    if (!enabled) return rows;
    const api = this.locationApi();
    const locationsAvailable = Boolean(api);
    const location = this.currentLocation();
    return filterBuyCatalog(rows, {
      enabled: true,
      locationsAvailable,
      location,
      capability: locationsAvailable ? this.capabilityFor(location) : undefined,
      shop,
      meetsTier: typeof api?.meetsTier === "function" ? api.meetsTier : null
    });
  }

  static presentation({ shop = null } = {}) {
    const enabled = this.enabled();
    if (!enabled) return describeLocationTrade({ enabled: false });
    const api = this.locationApi();
    const locationsAvailable = Boolean(api);
    const location = this.currentLocation();
    return describeLocationTrade({
      enabled: true,
      locationsAvailable,
      location,
      capability: locationsAvailable ? this.capabilityFor(location) : undefined,
      shop,
      meetsTier: typeof api?.meetsTier === "function" ? api.meetsTier : null
    });
  }
}
