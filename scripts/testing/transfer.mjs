import { assert } from '../../../morelord-core/scripts/testing/in-game.js';
import { TransferService } from '../services/transfer-service.js';
import { MorelordMarketplaceApp } from '../apps/marketplace-app.js';

const wait = async (predicate, label = 'cart interaction') => {
  const deadline = Date.now() + 30000;
  while (!predicate()) {
    assert(Date.now() < deadline, `Transfer ${label} timed out.`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};

export const transferCheck = {
  id: 'morelord-marketplace.transfer',
  async run() {
    assert(game.user.isGM, 'Run transfer fixtures as a GM.');
    const player = game.users.find(user => !user.isGM);
    assert(player, 'At least one player user is required.');
    const actors = [], messages = [], baseline = new Set(game.messages.map(message => message.id));
    let app;
    try {
      for (const [name, type] of [['Sender', 'character'], ['Recipient', 'character'], ['Group', 'group']]) {
        actors.push(await Actor.create({ name: `Transfer test ${name}`, type, ownership: { [player.id]: 3 } }));
      }
      const [sender, recipient, group] = actors;
      const [arrows, sword] = await sender.createEmbeddedDocuments('Item', [
        { name: 'Transfer test arrows', type: 'loot', img: 'icons/svg/item-bag.svg', system: { quantity: 5, price: { value: 0, denomination: 'gp' } }, flags: { 'morelord-marketplace': { unsellable: true } } },
        { name: 'Transfer test sword', type: 'weapon', img: 'icons/svg/sword.svg', system: { quantity: 1, equipped: true } }
      ]);
      app = new MorelordMarketplaceApp(); app.actorId = sender.id; app.activeTab = 'transfer';
      await app.render(true);
      assert([...app.element.querySelectorAll('[role="tab"]')].map(tab => tab.dataset.tab).join(',') === 'sell,transfer,buy,wishlist', 'Marketplace uses the requested Core tab order.');
      app.activeTab = 'sell'; await app.render(true);
      app.element.querySelector('[data-tab="sell"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await wait(() => app.activeTab === 'transfer' && app.element.querySelector('[data-action=addTransfer]'), 'keyboard tab activation');
      assert(document.activeElement?.id === 'ml-marketplace-tab-transfer', 'Keyboard tab activation preserves focus.');
      assert(app.element.querySelector('[data-action=addTransfer]'), 'Transfer inventory renders using actual templates.');
      assert(app.element.textContent.includes('Shopping Cart'), 'Transfer Shopping Cart renders.');
      assert(app.element.querySelectorAll('thead th').length === 3, 'Transfer omits List Price and Sell Price columns.');
      const row = app.element.querySelector(`[data-action="addTransfer"][data-item-id="${arrows.id}"]`).closest('tr');
      assert(row.querySelector('.fa-coin') && row.querySelector('.fa-sack-dollar'), 'Transfer uses Sell inventory action icons.');
      for (let index = 0; index < 3; index++) await MorelordMarketplaceApp.addTransfer.call(app, new Event('click'), app.element.querySelector(`[data-action="addTransfer"][data-item-id="${arrows.id}"]`));
      assert(app.transferCart.get(arrows.id) === 3, `Expected three cart items: ${JSON.stringify({ cart: [...app.transferCart], source: app.actor?.id, expected: sender.id, busy: app.isCheckingOut, button: app.element.querySelector('[data-action=addTransfer]')?.outerHTML })}`);
      await wait(() => app.transferCart.get(arrows.id) === 3 && app.element.querySelector('[data-action=adjustTransferQuantity]'), 'adding three items');
      const select = app.element.querySelector('[data-ml-marketplace-transfer-target]');
      select.value = recipient.id; select.dispatchEvent(new Event('change'));
      await wait(() => !app.element.querySelector('[data-action="checkoutTransfer"]').disabled, 'recipient selection');
      app.element.querySelector('[data-action="checkoutTransfer"]').click();
      await wait(() => !app.isCheckingOut && !app.transferCart.size, 'checkout completion');
      assert(sender.items.get(arrows.id).system.quantity === 2, 'Partial source stack remains.');
      assert(recipient.items.find(item => item.name === arrows.name)?.system.quantity === 3, 'Recipient receives requested quantity.');
      const receipt = game.messages.find(message => !baseline.has(message.id) && message.content.includes('transferred items to'));
      assert(receipt && receipt.content.includes(recipient.uuid), 'Transaction card names recipient.');
      messages.push(receipt.id);
      const received = recipient.items.find(item => item.name === arrows.name);
      assert(receipt.content.includes(received.uuid), 'Chat item link points to received item.');
      const request = { requestId: foundry.utils.randomID(), actorId: sender.id, targetId: group.id, items: [{ itemId: sword.id, quantity: 1 }] };
      await TransferService.channel.executeAsUser('checkout', request, game.user.id);
      await TransferService.channel.executeAsUser('checkout', request, game.user.id);
      assert(!sender.items.get(sword.id), 'Whole stack is removed from sender.');
      assert(group.items.filter(item => item.name === sword.name).length === 1, 'Repeated socket request resolves once.');
      assert(!group.items.find(item => item.name === sword.name).system.equipped, 'Received equipment is unequipped.');
      const sourceQuantity = sender.items.get(arrows.id).system.quantity;
      let rejected = false;
      try { await TransferService.channel.executeAsUser('checkout', { requestId: foundry.utils.randomID(), actorId: sender.id, targetId: recipient.id, items: [{ itemId: arrows.id, quantity: 99 }] }, game.user.id); }
      catch { rejected = true; }
      assert(rejected && sender.items.get(arrows.id).system.quantity === sourceQuantity, 'Stale quantity rejects without mutation.');
    } finally {
      await app?.close();
      for (const message of game.messages) {
        if (!baseline.has(message.id) && message.content.includes('Transfer test')) messages.push(message.id);
      }
      if (messages.length) await ChatMessage.deleteDocuments([...new Set(messages)]);
      for (const actor of actors) await actor.delete();
    }
  }
};

export function playerTransferCheck({ sourceId, recipientId, groupId, gmId }) {
  return {
    id: 'morelord-marketplace.player-transfer',
    async run() {
      const source = game.actors.get(sourceId), recipient = game.actors.get(recipientId), group = game.actors.get(groupId);
      assert(!game.user.isGM && source.isOwner && !recipient.isOwner && !group.isOwner, 'Player owns only the sending inventory.');
      let app;
      const channel = TransferService.channel;
      // Test against the fresh isolated GM client, leaving other GM sessions untouched.
      if (gmId) TransferService.channel = { ...channel, executeAsGM: (type, data) => channel.executeAsUser(type, data, gmId) };
      try {
        app = new MorelordMarketplaceApp(); app.actorId = sourceId; app.activeTab = 'transfer';
        await app.render(true);
        const item = source.items.find(item => item.type === 'loot');
        const row = app.element.querySelector(`[data-action="addTransfer"][data-item-id="${item.id}"]`).closest('tr');
        row.querySelector('[data-action="addTransfer"][data-all]').click();
        await wait(() => app.transferCart.get(item.id) === 5 && app.element.querySelector('[data-action=adjustTransferQuantity]'));
        for(let index=0;index<2;index++) {
          await MorelordMarketplaceApp.adjustTransferQuantity.call(app,new Event('click'),app.element.querySelector('[data-action="adjustTransferQuantity"][data-delta="-1"]'));
        }
        await wait(() => app.transferCart.get(item.id) === 3);
        await MorelordMarketplaceApp.adjustTransferQuantity.call(app, new Event('click'), app.element.querySelector('[data-action="adjustTransferQuantity"][data-delta="1"]'));
        assert(app.transferCart.get(item.id) === 4, 'Plus increments the cart quantity.');
        await MorelordMarketplaceApp.adjustTransferQuantity.call(app, new Event('click'), app.element.querySelector('[data-action="adjustTransferQuantity"][data-delta="-1"]'));
        await app.render(true);
        const select = app.element.querySelector('[data-ml-marketplace-transfer-target]'); select.value = recipientId; select.dispatchEvent(new Event('change'));
        await wait(() => !app.element.querySelector('[data-action="checkoutTransfer"]').disabled);
        app.element.querySelector('[data-action="checkoutTransfer"]').click();
        await wait(() => !app.isCheckingOut && !app.transferCart.size);
        assert(source.items.get(item.id).system.quantity === 2, 'Player sends an edited quantity through actual UI/socket.');
        const sword = source.items.find(item => item.type === 'weapon');
        await TransferService.checkout({ actorId: sourceId, targetId: groupId, items: [{ itemId: sword.id, quantity: 1 }] });
        assert(!source.items.get(sword.id), 'Player sends a whole stack to an unowned Group.');
        let rejected = false;
        try { await TransferService.checkout({ actorId: recipientId, targetId: sourceId, items: [{ itemId: 'invalid', quantity: 1 }] }); }
        catch { rejected = true; }
        assert(rejected, 'GM rejects a player sending from an unowned inventory.');
      } finally { TransferService.channel = channel; await app?.close(); }
    }
  };
}

export const marketplaceLayoutCheck = {
  id: 'morelord-marketplace.cart-filter-layout',
  async run() {
    let app;
    try {
      app = new MorelordMarketplaceApp(); await app.render(true); app.setPosition({ width: 1280 });
      const sellLayout = app.element.querySelector('.ml-marketplace-sell-layout');
      assert(Math.abs(sellLayout.querySelector('.ml-marketplace-cart-panel').getBoundingClientRect().width / sellLayout.getBoundingClientRect().width - 0.3) < 0.02, 'Sell cart occupies 30% of the layout.');
      assert(app.element.querySelectorAll('thead th').length === 5, 'Shared Sell table retains its price columns.');
      await MorelordMarketplaceApp.switchTab.call(app, new Event('click'), app.element.querySelector('[data-tab="buy"]'));
      const layout = app.element.querySelector('.ml-marketplace-buy-layout');
      assert(Math.abs(layout.querySelector('.ml-marketplace-cart-panel').getBoundingClientRect().width / layout.getBoundingClientRect().width - 0.3) < 0.02, 'Buy cart occupies 30% of the layout.');
      const source = layout.querySelector('td.ml-marketplace-source-column > .ml-truncate');
      assert(source && getComputedStyle(source).textOverflow === 'ellipsis' && source.title.includes(source.textContent), 'Source has fixed-width ellipsis and full-name tooltip.');
      const details = layout.querySelector('details[data-ml-section-key]');
      if (!details.open) details.querySelector('summary').click();
      const before = layout.querySelector('.ml-marketplace-buy-results').getBoundingClientRect().width;
      details.querySelector('summary').click();
      assert(!details.open && layout.querySelector('.ml-marketplace-buy-results').getBoundingClientRect().width > before + 100, 'Collapsing filters frees column width.');
      await new Promise(resolve => setTimeout(resolve, 100)); await app.render(true);
      assert(!app.element.querySelector('details[data-ml-section-key]').open, 'Core remembers collapsed filters across redraws.');
    } finally { await app?.close(); }
  }
};
