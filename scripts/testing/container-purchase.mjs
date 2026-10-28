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
