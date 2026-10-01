import test from 'node:test';
import assert from 'node:assert/strict';
let nextId = 0;
globalThis.foundry = { utils: { deepClone: structuredClone, randomID: () => `transfer${++nextId}`, escapeHTML: value => value.replaceAll('<', '&lt;') } };
const { TransferService } = await import('../scripts/services/transfer-service.js');

function fixture() {
  const collection = entries => Object.assign(entries, { get(id) { return this.find(entry => entry.id === id); } });
  const actor = (id, type = 'character') => ({ id, uuid: `Actor.${id}`, name: id, type, hasPlayerOwner: true, items: collection([]), system: { currency: { gp: 10 } }, testUserPermission: user => id === 'sender' && user.id === 'player',
    async createEmbeddedDocuments(_, data) {
      const items = data.map(data => ({ ...structuredClone(data), id: data._id, uuid: `${this.uuid}.Item.${data._id}`, toObject() { const { toObject, ...copy } = this; return structuredClone(copy); } }));
      this.items.push(...items); return items;
    },
    async updateEmbeddedDocuments(_, updates) { for (const update of updates) this.items.get(update._id).system.quantity = update['system.quantity']; },
    async deleteEmbeddedDocuments(_, ids) { for (const id of ids) this.items.splice(this.items.findIndex(item => item.id === id), 1); }
  });
  const sender = actor('sender'), target = actor('recipient'), group = actor('party', 'group');
  const player = { id: 'player', isGM: false, active: true };
  globalThis.game = { user: { id: 'gm', isGM: true }, users: collection([player]), actors: collection([sender, target, group]) };
  const cards = [];
  globalThis.ChatMessage = { getSpeaker: ({ actor }) => ({ actor: actor.id }), create: async data => { cards.push(data); return data; } };
  TransferService.requests.clear();
  return { sender, target, group, player, cards, add: async (id, quantity = 5, type = 'loot', system = {}) => (await sender.createEmbeddedDocuments('Item', [{ _id: id, name: id, img: 'icons/svg/item-bag.svg', type, flags: { custom: { marker: true } }, system: { quantity, equipped: true, attuned: true, ...system } }]))[0] };
}

test('partial stack and whole item transfer to unowned character; duplicate request is resolved once', async () => {
  const f = fixture(); await f.add('arrows'); await f.add('sword', 1, 'weapon');
  const request = { requestId: 'once', actorId: 'sender', targetId: 'recipient', items: [{ itemId: 'arrows', quantity: 3 }, { itemId: 'sword', quantity: 1 }] };
  await TransferService.resolve(request, 'player'); await TransferService.resolve(request, 'player');
  assert.equal(f.sender.items.get('arrows').system.quantity, 2);
  assert.equal(f.sender.items.get('sword'), undefined);
  assert.deepEqual(f.target.items.map(item => item.system.quantity), [3, 1]);
  assert.equal(f.target.items[0].system.equipped, false);
  assert.equal(f.target.items[0].system.attuned, false);
  assert.equal(f.target.items[0].system.container, null);
  assert.equal(f.target.items[0].flags.custom.marker, true);
  assert.equal(f.cards.length, 1); assert.match(f.cards[0].content, /transferred items to/);
  assert.match(f.cards[0].content, /Actor.recipient.Item/);
  assert.match(f.cards[0].content, /ml-marketplace-cart-transaction-card/);
  assert.match(f.cards[0].content, /Items transferred:<\/strong> 4/);
  assert.equal(f.sender.system.currency.gp, 10); assert.equal(f.target.system.currency.gp, 10);
});

test('Group recipient and transfer validation reject unauthorized, malformed, excessive and duplicate lines', async () => {
  const f = fixture(); await f.add('arrows');
  const request = { actorId: 'sender', targetId: 'party', items: [{ itemId: 'arrows', quantity: 2 }] };
  for (const change of [{ actorId: 'recipient' }, { targetId: 'sender' }, { items: [null] }, { items: [{ itemId: 'arrows', quantity: 6 }] }, { items: [{ itemId: 'arrows', quantity: 1.5 }] }, { items: [...request.items, ...request.items] }]) {
    await assert.rejects(TransferService.execute({ ...request, ...change }, 'player'));
    assert.equal(f.sender.items.get('arrows').system.quantity, 5); assert.equal(f.group.items.length, 0);
  }
  await TransferService.execute(request, 'player'); assert.equal(f.group.items[0].system.quantity, 2);
});

test('nonempty containers are excluded; contained items transfer without stale container references', async () => {
  const f = fixture(); await f.add('bag', 1, 'container'); await f.add('arrows', 5, 'loot', { container: 'bag' }); await f.add('feat', 1, 'feat');
  assert.deepEqual(TransferService.items(f.sender).map(item => item.id), ['arrows']);
  await TransferService.execute({ actorId: 'sender', targetId: 'recipient', items: [{ itemId: 'arrows', quantity: 5 }] }, 'player');
  assert.equal(f.target.items[0].system.container, null); assert.equal(f.sender.items.get('bag').system.quantity, 1);
});

test('partial source deletion failure restores both inventories and does not remove unrelated recipient items', async () => {
  const f = fixture(); await f.add('arrows'); await f.add('sword', 1, 'weapon');
  const remove = f.sender.deleteEmbeddedDocuments;
  f.sender.deleteEmbeddedDocuments = async (...args) => { await remove.apply(f.sender, args); await f.target.createEmbeddedDocuments('Item', [{ _id: 'unrelated', name: 'unrelated', system: { quantity: 1 } }]); throw Error('simulated deletion failure'); };
  await assert.rejects(TransferService.execute({ actorId: 'sender', targetId: 'recipient', items: [{ itemId: 'arrows', quantity: 3 }, { itemId: 'sword', quantity: 1 }] }, 'player'), /simulated/);
  assert.equal(f.sender.items.get('arrows').system.quantity, 5); assert.equal(f.sender.items.get('sword').system.quantity, 1);
  assert.deepEqual(f.target.items.map(item => item.id), ['unrelated']); assert.equal(f.cards.length, 0);
});

test('partially failed destination creation is rolled back; chat failure does not undo a successful transfer', async () => {
  const f = fixture(); await f.add('arrows');
  const create = f.target.createEmbeddedDocuments;
  f.target.createEmbeddedDocuments = async (...args) => { await create.apply(f.target, args); throw Error('simulated creation failure'); };
  const request = { actorId: 'sender', targetId: 'recipient', items: [{ itemId: 'arrows', quantity: 3 }] };
  await assert.rejects(TransferService.execute(request, 'player'), /simulated/);
  assert.equal(f.sender.items[0].system.quantity, 5); assert.equal(f.target.items.length, 0);
  f.target.createEmbeddedDocuments = create;
  ChatMessage.create = async () => { throw Error('simulated chat failure'); };
  const result = await TransferService.execute(request, 'player');
  assert.equal(result.status, 'completed'); assert.ok(result.warning);
  assert.equal(f.sender.items[0].system.quantity, 2); assert.equal(f.target.items[0].system.quantity, 3);
});

test('inventory changed during recipient creation is not overwritten by rollback', async () => {
  const f = fixture(); await f.add('arrows');
  const create = f.target.createEmbeddedDocuments;
  f.target.createEmbeddedDocuments = async (...args) => { const result = await create.apply(f.target, args); f.sender.items.get('arrows').system.quantity = 4; return result; };
  await assert.rejects(TransferService.execute({ actorId: 'sender', targetId: 'recipient', items: [{ itemId: 'arrows', quantity: 3 }] }, 'player'), /inventory changed/);
  assert.equal(f.sender.items.get('arrows').system.quantity, 4); assert.equal(f.target.items.length, 0); assert.equal(f.cards.length, 0);
});

test('shared cart receipt keeps purchase/sale prices and respects their card setting', async () => {
  const f = fixture();
  const { TransactionService } = await import('../scripts/services/transaction-service.js');
  game.settings = { get: () => true };
  const items = [{ name: 'arrows', uuid: 'Actor.sender.Item.arrows', quantity: 2, totalPriceCp: 100 }];
  await TransactionService.postCart({ type: 'sell', actor: f.sender, items, totalCp: 100 });
  await TransactionService.postCart({ type: 'buy', actor: f.sender, fundingActor: f.group, items, totalCp: 100 });
  assert.match(f.cards[0].content, /sold a cart/); assert.match(f.cards[0].content, /Total:<\/strong> 1 gp/);
  assert.match(f.cards[1].content, /bought a cart/); assert.match(f.cards[1].content, /Paid from:<\/strong> party/);
  game.settings.get = () => false;
  await TransactionService.postCart({ type: 'buy', actor: f.sender, items, totalCp: 100 });
  assert.equal(f.cards.length, 2);
});

test('GM checkout uses its own client; player checkout uses Core active-GM routing', async () => {
  fixture(); const calls = [];
  TransferService.channel = {
    executeAsUser: (...args) => calls.push(['user', ...args]),
    executeAsGM: (...args) => calls.push(['gm', ...args])
  };
  const request = { actorId: 'sender', targetId: 'recipient', items: [{ itemId: 'arrows', quantity: 1 }] };
  await TransferService.checkout(request);
  assert.equal(calls[0][0], 'user'); assert.equal(calls[0][3], 'gm'); assert.ok(calls[0][2].requestId);
  game.user = game.users.get('player'); await TransferService.checkout(request);
  assert.equal(calls[1][0], 'gm'); assert.notEqual(calls[1][2].requestId, calls[0][2].requestId);
});
