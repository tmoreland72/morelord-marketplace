import test from 'node:test';
import assert from 'node:assert/strict';
import { grantPurchasedItems, preparePurchaseItems } from '../scripts/services/purchase-items.js';
import { CompendiumService } from '../scripts/services/compendium-service.js';
import { TransactionApprovalService } from '../scripts/services/transaction-approval-service.js';
import { TransactionService } from '../scripts/services/transaction-service.js';
import { CurrencyService } from '../scripts/services/currency-service.js';
import { PricingService } from '../scripts/services/pricing-service.js';

test('purchases use native container expansion for each copy without changing the source', async t => {
  const source = { toObject: () => ({ _id: 'source', type: 'container' }) };
  const previous = globalThis.CONFIG;
  t.after(() => { globalThis.CONFIG = previous; });
  let serial = 0;
  globalThis.CONFIG = { Item: { documentClass: { async createWithContents(items) {
    return items.flatMap(item => {
      assert.equal(item, source);
      const id = String(++serial);
      return [{ _id: id, type: 'container' }, { _id: String(++serial), system: { container: id, quantity: 10 } }];
    });
  } } } };
  const data = await preparePurchaseItems([source, source]);
  assert.equal(data.length, 4);
  assert.equal(new Set(data.map(item => item._id)).size, 4);
  assert.equal(data[1].system.container, data[0]._id);
  assert.equal(data[3].system.container, data[2]._id);
  assert.equal(source.toObject()._id, 'source');
});

test('systems without container preparation retain ordinary item import', async t => {
  const previous = globalThis.CONFIG;
  t.after(() => { globalThis.CONFIG = previous; });
  globalThis.CONFIG = {};
  assert.deepEqual(await preparePurchaseItems([{ toObject: () => ({ _id: 'original', name: 'Rope' }) }]), [{ name: 'Rope' }]);
});

test('direct, cart, and approved purchases create contents with preserved generated IDs and charge only pack prices', async t => {
  const previous = { game: globalThis.game, CONFIG: globalThis.CONFIG, fromUuid: globalThis.fromUuid };
  t.after(() => Object.assign(globalThis, previous));
  const source = { name: "Explorer's Pack", type: 'container', system: {}, toObject: () => ({ type: 'container' }) };
  const packDoc = { collection: "pack", documentName: "Item", getDocument: async () => source };
  const packs = [packDoc];
  packs.get = id => packs.find(entry => entry.collection === id);
  globalThis.game = { user: { isGM: true }, modules: new Map(), system: { id: "other" }, settings: { get: (_module, key) => key !== "enableLocations" }, packs };
  let serial = 0, balance = 1000;
  globalThis.CONFIG = { Item: { documentClass: { createWithContents: async items => items.flatMap(() => {
    const root = String(++serial);
    return [{ _id: root, type: 'container' }, { _id: String(++serial), type: 'loot', system: { container: root, quantity: 10 } }];
  }) } } };
  const owned = [];
  const actor = { items: owned, async createEmbeddedDocuments(type, data, options) {
    assert.equal(type, 'Item');
    assert.equal(options?.keepId, true);
    owned.push(...data.map(item => ({ ...item, id: item._id })));
    return data.map(item => ({ id: item._id, uuid: 'Actor.fixture.Item.' + item._id }));
  } };
  globalThis.fromUuid = async () => actor;
  t.mock.method(PricingService, 'getItemPriceCp', () => 100);
  t.mock.method(PricingService, 'getBuyPriceCp', value => value);
  t.mock.method(CurrencyService, 'getCurrency', () => ({ cp: balance }));
  t.mock.method(CurrencyService, 'canAfford', (_actor, price) => balance >= price);
  t.mock.method(CurrencyService, 'deductCurrency', async (_actor, price) => { balance -= price; });
  t.mock.method(TransactionService, 'postCart', async () => {});
  await CompendiumService.buyCompendiumItem({ actor, packId: 'pack', documentId: 'pack-item', suppressPost: true });
  await CompendiumService.buyCart({ actor, items: [{ packId: 'pack', documentId: 'pack-item', quantity: 2, priceCp: 100 }] });
  await TransactionApprovalService.executeApprovedBuy({ actorUuid: 'Actor.fixture', totalPriceCp: 100, payload: { packId: 'pack', documentId: 'pack-item' } });
  await TransactionApprovalService.executeApprovedBuyCart({ totalPriceCp: 200 }, actor, actor,
    [{ packId: 'pack', documentId: 'pack-item', quantity: 2, unitPriceCp: 100 }]);
  assert.equal(owned.length, 12);
  assert.equal(balance, 400);
  for (const item of owned.filter(item => item.type === 'loot')) assert(owned.some(parent => parent.id === item.system.container));
  assert.equal(new Set(owned.map(item => item.id)).size, owned.length);
});

test('a stack purchase grants one item of the bought quantity, not the source quantity', async t => {
  const previous = globalThis.CONFIG;
  t.after(() => { globalThis.CONFIG = previous; });
  globalThis.CONFIG = {};
  const source = {
    name: 'Rations', type: 'loot', uuid: 'Compendium.pack.Item.rations', system: { quantity: 7 },
    toObject() { return { name: this.name, type: this.type, system: { quantity: this.system.quantity } }; }
  };
  const owned = [];
  const actor = {
    items: owned,
    async createEmbeddedDocuments(_type, data) {
      const created = data.map((item, index) => ({ ...item, id: item._id ?? `new-${owned.length + index}`, uuid: `Actor.hero.Item.${owned.length + index}` }));
      owned.push(...created);
      return created;
    },
    async updateEmbeddedDocuments(_type, updates) {
      for (const update of updates) owned.find(item => item.id === update._id).system.quantity = update['system.quantity'];
    }
  };
  const first = await grantPurchasedItems(actor, source, 5);
  assert.equal(source.system.quantity, 7);
  assert.equal(owned.length, 1);
  assert.equal(owned[0].system.quantity, 5);
  assert.deepEqual(first.created, [owned[0].id]);
  assert.deepEqual(first.updated, []);

  owned.push({ id: 'packed', type: 'loot', uuid: 'Actor.hero.Item.packed', system: { quantity: 9, container: 'bag' }, flags: { core: { sourceId: source.uuid } } });
  const merged = await grantPurchasedItems(actor, source, 5);
  assert.equal(owned.length, 2);
  assert.equal(owned[0].system.quantity, 10);
  assert.equal(owned[1].system.quantity, 9);
  assert.deepEqual(merged.created, []);
  assert.deepEqual(merged.updated, [{ id: owned[0].id, quantity: 5 }]);
});

test('container purchases stay one copy per unit and reset each copy to quantity 1', async t => {
  const previous = globalThis.CONFIG;
  t.after(() => { globalThis.CONFIG = previous; });
  let serial = 0;
  globalThis.CONFIG = { Item: { documentClass: { async createWithContents(items) {
    return items.flatMap(item => {
      const id = `box-${++serial}`;
      return [
        { _id: id, type: 'container', system: { quantity: item.system.quantity } },
        { _id: `gear-${serial}`, type: 'loot', system: { container: id, quantity: 7 } }
      ];
    });
  } } } };
  const source = { type: 'container', system: { quantity: 7 }, toObject() { return { type: 'container', system: { quantity: 7 } }; } };
  const owned = [];
  const actor = { items: owned, async createEmbeddedDocuments(_type, data) {
    const created = data.map(item => ({ ...item, id: item._id }));
    owned.push(...created);
    return created;
  } };
  await grantPurchasedItems(actor, source, 2);
  const boxes = owned.filter(item => item.type === 'container');
  const gear = owned.filter(item => item.type === 'loot');
  assert.equal(boxes.length, 2);
  assert.deepEqual(boxes.map(item => item.system.quantity), [1, 1]);
  assert.deepEqual(gear.map(item => item.system.quantity), [7, 7]);
  assert.equal(source.system.quantity, 7);
});

test('a non-container cart quantity is one stack, and a container cart stays one copy per unit', async t => {
  const previous = { game: globalThis.game, CONFIG: globalThis.CONFIG, fromUuid: globalThis.fromUuid };
  t.after(() => Object.assign(globalThis, previous));
  const rations = {
    name: 'Rations', type: 'loot', uuid: 'Compendium.pack.Item.rations', system: { quantity: 7 },
    toObject() { return { name: this.name, type: this.type, system: { quantity: this.system.quantity } }; }
  };
  const pack = {
    name: "Explorer's Pack", type: 'container', uuid: 'Compendium.pack.Item.pack', system: { quantity: 4 },
    toObject() { return { name: this.name, type: this.type, system: { quantity: this.system.quantity } }; }
  };
  let serial = 0;
  const documents = { rations, pack };
  const packs = [{ collection: 'pack', documentName: 'Item', getDocument: async id => documents[id] }];
  packs.get = id => packs.find(entry => entry.collection === id);
  globalThis.game = { user: { isGM: true }, modules: new Map(), system: { id: 'other' }, settings: { get: (_module, key) => key !== 'enableLocations' }, packs };
  globalThis.CONFIG = { Item: { documentClass: { async createWithContents(items) {
    return items.map(item => {
      const data = item.toObject();
      data._id = `${item.type}-${++serial}`;
      if (item.type === 'container') data.system.contentsNote = 'packed';
      return data;
    });
  } } } };
  const owned = [];
  const actor = { items: owned, async createEmbeddedDocuments(_type, data, options) {
    assert.equal(options?.keepId, true);
    const created = data.map(item => ({ ...item, id: item._id, uuid: `Actor.hero.Item.${item._id}` }));
    owned.push(...created);
    return created;
  }, async updateEmbeddedDocuments() {} };
  let balance = 5000;
  t.mock.method(PricingService, 'getItemPriceCp', () => 100);
  t.mock.method(PricingService, 'getBuyPriceCp', value => value);
  t.mock.method(CurrencyService, 'getCurrency', () => ({ cp: balance }));
  t.mock.method(CurrencyService, 'canAfford', (_actor, price) => balance >= price);
  t.mock.method(CurrencyService, 'deductCurrency', async (_actor, price) => { balance -= price; });
  t.mock.method(TransactionService, 'postCart', async () => {});
  await CompendiumService.buyCart({ actor, items: [{ packId: 'pack', documentId: 'rations', quantity: 5, priceCp: 100 }] });
  assert.equal(owned.length, 1);
  assert.equal(owned[0].system.quantity, 5);
  assert.equal(rations.system.quantity, 7);
  await CompendiumService.buyCart({ actor, items: [{ packId: 'pack', documentId: 'pack', quantity: 2, priceCp: 100 }] });
  const boxes = owned.filter(item => item.type === 'container');
  assert.equal(boxes.length, 2);
  assert.deepEqual(boxes.map(item => item.system.quantity), [1, 1]);
  assert.equal(owned.length, 3);
});
