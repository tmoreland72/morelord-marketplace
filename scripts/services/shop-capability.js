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
