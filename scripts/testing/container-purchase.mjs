import { assert } from '../../../morelord-core/scripts/testing/in-game.js';
import { CompendiumService } from '../services/compendium-service.js';
import { loadAllowedItem } from '../services/configured-sources.js';
import { CurrencyService } from '../services/currency-service.js';
import { PricingService } from '../services/pricing-service.js';
import { TransactionApprovalService } from '../services/transaction-approval-service.js';

export const containerPurchaseCheck = {
  id: 'morelord-marketplace.container-purchase',
  async run() {
    assert(game.user.isGM, 'Run as GM in Dev1.');
    const rows = await CompendiumService.getInventorySearchCatalog();
    const row = rows.find(row => /explorer.?s pack/i.test(row.name));
    assert(row, 'Enable a compendium containing Explorer’s Pack.');
    const pack = game.packs.get(row.packId);
    const index = await pack.getIndex({ fields: ["name", "system.container"] });
    const parentById = new Map();
    const parentIdOf = entry => {
      const raw = entry?.system?.container;
      const value = raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
      if (value && typeof value === "object") return String(value.id ?? value._id ?? "").trim();
      return String(value ?? "").trim();
    };
    for (const entry of index) {
      const parentId = parentIdOf(entry);
      if (parentId) parentById.set(entry._id, parentId);
    }
    const packed = [];
    for (const entry of index) {
      const seen = new Set();
      let parentId = parentById.get(entry._id);
      while (parentId && !seen.has(parentId)) {
        if (parentId === row.documentId) { packed.push(entry._id); break; }
        seen.add(parentId);
        parentId = parentById.get(parentId);
      }
    }
    assert(packed.length > 0, "Explorer's Pack indexes contained items.");
    const catalog = await CompendiumService.getBuyableCatalog();
    assert(catalog.some(item => item.packId === row.packId && item.documentId === row.documentId), "The pack remains a Buy listing.");
    for (const id of packed) {
      assert(!catalog.some(item => item.packId === row.packId && item.documentId === id), "Packed items are not separate Buy listings.");
    }
    const loaded = await loadAllowedItem(row.packId, row.documentId);
    assert(loaded.status === "ok", "Explorer's Pack must come from an enabled compendium.");
    const source = loaded.item;
    const expected = await CONFIG.Item.documentClass.createWithContents([source]);
    assert(expected.length > 1, 'The source pack must contain actual items.');
    let actor;
    try {
      actor = await Actor.create({ name: 'Marketplace container purchase regression', type: 'character', system: { currency: { gp: 10000 } } });
      const priceCp = PricingService.getBuyPriceCp(PricingService.getItemPriceCp(source));
      const baseline = CurrencyService.currencyToCp(CurrencyService.getCurrency(actor));
      const verify = (copies, cost) => {
        const roots = actor.items.filter(item => item.name === source.name && !item.system.container);
        assert(roots.length === copies, 'Each purchase has a separate top-level pack.');
        assert(actor.items.size === expected.length * copies, 'All contents arrive with every copy.');
        for (const item of actor.items) {
          if (item.system.container) assert(actor.items.has(item.system.container), 'Contents reference a newly owned container.');
        }
        assert(CurrencyService.currencyToCp(CurrencyService.getCurrency(actor)) === baseline - cost, 'Only the listed pack price is charged.');
      };
      await CompendiumService.buyCompendiumItem({ actor, packId: row.packId, documentId: row.documentId, suppressPost: true });
      verify(1, priceCp);
      await TransactionApprovalService.executeApprovedBuyCart({ totalPriceCp: priceCp * 2 }, actor, actor,
        [{ packId: row.packId, documentId: row.documentId, quantity: 2, unitPriceCp: priceCp }]);
      verify(3, priceCp * 3);
    } finally {
      await actor?.delete();
    }
  }
};
