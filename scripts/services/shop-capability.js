export const MARKETPLACE_CAPABILITY_TIERS = Object.freeze([
  "common",
  "uncommon",
  "rare",
  "veryRare",
  "legendary"
]);

const RANK = new Map(MARKETPLACE_CAPABILITY_TIERS.map((tier, index) => [tier.toLowerCase(), index]));

export function normalizeCapabilityTier(value) {
  const normalized = String(value ?? "").replace(/[\s_-]+/g, "").toLowerCase();
  return MARKETPLACE_CAPABILITY_TIERS.find(tier => tier.toLowerCase() === normalized) ?? null;
}

export function rarityWithinCapability(rarity, capabilityTier) {
  const tier = normalizeCapabilityTier(capabilityTier);
  if (!tier) return true;
  const rarityRank = RANK.get(String(rarity ?? "common").replace(/[\s_-]+/g, "").toLowerCase());
  return rarityRank !== undefined && rarityRank <= RANK.get(tier.toLowerCase());
}

export function inventoryEntryAllowedByCapability({ rarity, capabilityTier, manuallyIncluded = false } = {}) {
  return manuallyIncluded || rarityWithinCapability(rarity, capabilityTier);
}

/** Highest Marketplace capability on a location, or null when it has none. */
export function selectMarketplaceCapability(location, meetsTier = null, evaluateRequirements = null) {
  if (typeof evaluateRequirements === "function") {
    try {
      const evaluation = evaluateRequirements(
        [{ kind: "capability", type: "marketplace", tier: "common" }],
        { location }
      );
      const result = evaluation?.results?.find(entry => entry?.kind === "capability");
      const tier = result?.passed ? normalizeCapabilityTier(result.actual?.tier) : null;
      if (!tier) return null;
      return {
        type: "marketplace",
        tier,
        specialty: result.actual?.specialty ?? null
      };
    } catch {
      // Core rejected this record. Fall through to the same highest-tier rule.
    }
  }

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
