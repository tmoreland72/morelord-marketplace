import { assert } from '../../../morelord-core/scripts/testing/in-game.js';
import { ShopService } from '../services/shop-service.js';
import { CompendiumService } from '../services/compendium-service.js';
import { ActorService } from '../services/actor-service.js';
import { MorelordShopManagerApp } from '../apps/shop-manager-app.js';

export const manualShopItemsCheck = {
  id: 'morelord-marketplace.manual-shop-items',
  async run() {
    assert(game.user.isGM, 'Run the shop regression as a GM.');
    const rows = await CompendiumService.getInventorySearchCatalog();
    assert(rows.length >= 2, 'Enable at least two priced compendium items.');
    const [row, other] = rows;
    let shop;
    let app;
    try {
      shop = await ShopService.createShop({ name: 'Marketplace regression fixture', type: 'custom' });
      shop.manualInventoryOnly = true;
      shop.inventoryMode = 'unlimited';
      shop.purchaseItems = [{ uuid: row.uuid, name: row.name, type: row.typeKey, img: row.img }];
      await ShopService.saveShop(shop);
      await ShopService.addInventoryItem(shop.id, row, 3);
      await ShopService.adjustStock(shop.id, row, -3);
      shop = await ShopService.restock(shop.id, rows);
      assert(ShopService.getStock(shop, row) === 3, 'Restock restores the manual quantity.');
      assert(!ShopService.entryPassesShop(other, shop, other.packId), 'Unlisted catalog items are excluded.');
      const magical = rows.find(entry => ShopService.hasMagicalProperty(entry));
      assert(magical, 'Enable an item with the Magical property to test exclusion.');
      assert(!ShopService.entryPassesShop(magical, { ...shop, excludeMagical: true, inventoryOverrides: { included: [magical.uuid] } }, magical.packId), 'Magical property exclusion overrides manual inclusion.');
      const source = await fromUuid(row.uuid);
      const data = source.toObject();
      data._stats = { ...data._stats, compendiumSource: row.uuid };
      const owned = new CONFIG.Item.documentClass(data);
      const sellable = await ActorService.getSellableItems({ items: [owned] }, { shop });
      assert(sellable.length === 1, 'Matching owned item can be sold.');
      assert(!ShopService.acceptsPlayerItem(owned, { ...shop, purchaseItems: [{ uuid: other.uuid }] }), 'Nonmatching purchase list rejects the item.');
      app = new MorelordShopManagerApp({ shopId: shop.id });
      await app.render(true);
      await new Promise(resolve => requestAnimationFrame(resolve));
      assert(app.element.querySelector('[name="manualInventoryOnly"]')?.checked, 'Manual-only setting renders checked.');
      assert(app.element.textContent.includes('Player can sell'), 'Updated selling label renders.');
      assert(app.element.querySelector('[data-action="removePurchaseItem"]'), 'Configured purchase item renders with removal control.');
    } finally {
      await app?.close();
      if (shop) await ShopService.deleteShop(shop.id);
      CompendiumService.clearCatalogCache();
    }
  }
};
