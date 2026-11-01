import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePurchaseItems } from '../scripts/services/purchase-items.js';
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
