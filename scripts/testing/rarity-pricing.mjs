import { assert } from '../../../morelord-core/scripts/testing/in-game.js';
import { CompendiumService } from '../services/compendium-service.js';
import { PricingService } from '../services/pricing-service.js';
import { itemRarity } from '../../../morelord-core/scripts/services/item-rarity.js';

export const rarityPricingCheck = {
  id: 'morelord-marketplace.unpriced-rarity',
  async run() {
    const prices = { common: 100, uncommon: 400, rare: 4000, veryrare: 40000, legendary: 200000 };
    const catalog = await CompendiumService.getBuyableCatalog();
    let checked = 0;
    for (const pack of CompendiumService.getAllowedPacks()) {
      for (const entry of await CompendiumService.getPackIndex(pack)) {
        const gp = prices[itemRarity(entry.system)];
        if (!gp || Number(entry.system?.price?.value ?? entry.system?.price ?? 0) > 0
          || entry.flags?.['morelord-marketplace']?.customPrice) continue;
        const row = CompendiumService.indexEntryToMarketplaceRow(pack, entry);
        if (!row) continue; // Preserve configured-source and purchase restrictions.
        assert(row.listPriceCp === gp * 100, 'Unpriced catalog entry uses its standard rarity value.');
        assert(catalog.some(candidate => candidate.name === row.name), 'Unpriced item survives catalog construction.');
        const item = await pack.getDocument(entry._id);
        assert(PricingService.getItemPriceCp(item) === row.listPriceCp, 'Live document and index agree for checkout and selling.');
        assert(row.buyPriceCp === PricingService.getBuyPriceCp(gp * 100), 'Global rate applies after fallback.');
        if (++checked === 3) return;
      }
    }
    assert(checked > 0, 'Configure a source with an unpriced item of known rarity.');
  }
};

export const fragmentationGrenadeCheck = {
  id: 'morelord-marketplace.fragmentation-grenade',
  async run() {
    const catalog = await CompendiumService.getBuyableCatalog();
    const row = catalog.find(entry => entry.name === 'Grenade, Fragmentation');
    assert(row, 'Fragmentation grenade appears in the configured-source catalog.');
    assert(row.listPriceCp === 10000, 'Blank-rarity grenade has a 100 gp base price.');
    const item = await game.packs.get(row.packId).getDocument(row.documentId);
    assert(PricingService.getItemPriceCp(item) === row.listPriceCp, 'Grenade checkout uses the catalog base price.');
    assert(row.buyPriceCp === PricingService.getBuyPriceCp(10000), 'Grenade respects the configured buy rate.');
  }
};
