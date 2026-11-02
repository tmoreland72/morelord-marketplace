import { assert } from '../../../morelord-core/scripts/testing/in-game.js';
import { MorelordMarketplaceApp } from '../apps/marketplace-app.js';

function assertDisabledReason(button, label) {
  assert(button, `${label} is rendered.`);
  assert(button.disabled || button.getAttribute('aria-disabled') === 'true', `${label} is disabled.`);
  const tooltip = button.getAttribute('data-tooltip') ?? '';
  assert(tooltip.includes('<strong>'), `${label} explains why it is disabled.`);
  assert(!tooltip.includes('undefined'), `${label} has a specific reason.`);
}

export const disabledReasonCheck = {
  id: 'morelord-marketplace.disabled-reasons',
  async run() {
    assert(game.user.isGM, 'Run as GM in Dev1.');
    const app = new MorelordMarketplaceApp();
    try {
      await app.render(true);
      assertDisabledReason(app.element.querySelector('[data-action="checkoutSellCart"]'), 'Sell Cart');
      const sellAdd = [...app.element.querySelectorAll('[data-action="sellOne"], [data-action="sellAll"]')].find(button => button.disabled);
      if (sellAdd) assertDisabledReason(sellAdd, 'Sell add');
      const buyTab = app.element.querySelector('[data-tab="buy"]');
      if (buyTab) {
        await MorelordMarketplaceApp.switchTab.call(app, new Event('click'), buyTab);
        const purchase = app.element.querySelector('[data-action="checkoutCart"]');
        if (purchase) assertDisabledReason(purchase, 'Purchase');
        const buyAdd = [...app.element.querySelectorAll('[data-action="buyItem"]')].find(button => button.disabled);
        if (buyAdd) assertDisabledReason(buyAdd, 'Buy add');
      }
      const wishTab = app.element.querySelector('[data-tab="wishlist"]');
      if (wishTab) {
        await MorelordMarketplaceApp.switchTab.call(app, new Event('click'), wishTab);
        const wishBuy = [...app.element.querySelectorAll('.ml-marketplace-wishlist-tab [data-action="buyItem"]')].find(button => button.disabled);
        if (wishBuy) assertDisabledReason(wishBuy, 'Wishlist Buy');
      }
    } finally {
      await app.close();
    }
  }
};
