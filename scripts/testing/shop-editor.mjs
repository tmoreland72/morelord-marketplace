import { assert } from '../../../morelord-core/scripts/testing/in-game.js';
import { MorelordShopManagerApp } from '../apps/shop-manager-app.js';
import { MorelordMarketplaceApp } from '../apps/marketplace-app.js';
import { ShopService } from '../services/shop-service.js';

export const shopEditorCheck = {
  id: 'morelord-marketplace.shop-editor',
  async run() {
    assert(game.user.isGM, 'Run as GM with Shop Manager access.');
    const baseline = new Set(ShopService.getShops().map(shop => shop.id));
    let manager, marketplace;
    try {
      manager = new MorelordShopManagerApp(); await manager.render(true);
      assert(!manager.element.querySelector('.notes, .hint, .ml-marketplace-prefab-help, [data-stock-description]'), 'Shop Manager has no helper paragraphs.');
      assert(!manager.element.querySelector('[name=allowDuplicates]'), 'Repeat-selection option is removed.');
      assert(manager.element.querySelector('[data-action=newShop]'), 'New Shop is next to Import Shop.');
      assert(manager.element.querySelector('[data-action=selectShop].ml-list-button[aria-current="true"]'), 'Selected shops use Core list selection states.');
      manager.setPosition({ width: 700 });
      await new Promise(resolve => setTimeout(resolve, 100));
      const library = manager.element.querySelector('.ml-marketplace-shop-list-panel');
      const editor = manager.element.querySelector('.ml-marketplace-shop-editor-panel');
      assert(editor.getBoundingClientRect().top >= library.getBoundingClientRect().bottom, 'Compact shop editor starts below the full library without overlap.');
      manager.setPosition({ width: 1200 });
      assert(!manager.element.querySelector('[data-action=createShop], [data-action=createPrefabShop]'), 'Main manager has no templates or prefabs.');
      await MorelordShopManagerApp.newShop.call(manager, new Event('click'));
      let popup = manager.newShopWindow;
      assert(popup?.rendered && popup.element !== manager.element, 'New Shop opens a separate window.');
      const draftId = popup.selectedShopId;
      assert(popup.element.querySelector('[name=stockPlan]') && popup.element.querySelector('[name=exclusivelyMagical]'), 'Popup has the same full editor.');
      assert(!ShopService.getShop(draftId), 'Opening the popup does not save a shop.');
      await popup.close();
      assert(!ShopService.getShop(draftId), 'Closing an unsaved draft does not create a shop.');
      await MorelordShopManagerApp.newShop.call(manager, new Event('click')); popup = manager.newShopWindow;
      popup.element.querySelector('[name=name]').value = 'Shop editor regression fixture';
      const plan = popup.element.querySelector('[name=stockPlan]'); plan.value = 'manual'; plan.dispatchEvent(new Event('change'));
      assert(popup.element.querySelector('[data-random-stock]').hidden, 'Manual plan hides unused random controls.');
      await MorelordShopManagerApp.saveShop.call(popup, new Event('click'));
      assert(ShopService.getShop(manager.selectedShopId)?.name === 'Shop editor regression fixture', 'Save adds the draft to Existing Stores.');
      assert(!popup.rendered, 'Saving closes the new-shop popup.');
      await MorelordShopManagerApp.openInventoryLookup.call(manager, new Event('click'), manager.element.querySelector('[data-action=openInventoryLookup]'));
      assert(manager.itemPicker?.rendered && !manager.element.querySelector('[name=inventorySearch]'), 'Add Item uses Core popup without injected search.');
      await manager.itemPicker.close();
      marketplace = new MorelordMarketplaceApp(); await marketplace.render(true);
      for (const tab of ['sell', 'transfer', 'buy', 'wishlist']) {
        await MorelordMarketplaceApp.switchTab.call(marketplace, new Event('click'), marketplace.element.querySelector(`[data-tab="${tab}"]`));
        const panel = marketplace.element.querySelector('[role=tabpanel]');
        if (tab === 'wishlist') assert(!panel.querySelector('[data-ml-marketplace-shopper-select]'), 'Wishlist omits the shopper section.');
        else {
          const section = panel.firstElementChild;
          assert(section.getAttribute('aria-label') === (tab === 'transfer' ? 'Sender and Recipient' : 'Shopper and Payer'), 'Selectors are first in their tab.');
          assert(section.querySelector('label[data-ml-actor-select-layout=inline] > select'), 'Core selectors put portraits inside the control.');
          const cart = panel.querySelector('.ml-marketplace-cart-panel');
          assert(cart.querySelector('.ml-marketplace-cart-heading') && cart.querySelector('.ml-marketplace-cart-footer') && !cart.querySelector('select'), 'Transfer matches the existing Buy/Sell cart layout without actor controls.');
          assert(getComputedStyle(panel).gap === getComputedStyle(panel).getPropertyValue('--ml-space-3').trim(), 'Core supplies a standard gap between sections.');
        }
      }
      await marketplace.close();
      marketplace = new MorelordMarketplaceApp({ shopId: manager.selectedShopId }); await marketplace.render(true);
      assert(!marketplace.element.querySelector('[data-tab=transfer]'), 'Shops have no Transfer tab.');
    } finally {
      await marketplace?.close(); await manager?.close();
      for (const shop of ShopService.getShops()) if (!baseline.has(shop.id) && shop.name === 'Shop editor regression fixture') await ShopService.deleteShop(shop.id);
    }
  }
};
