import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseActorInventory } from '../../morelord-core/scripts/ui/actor-participation.js';
import { ActorService } from '../scripts/services/actor-service.js';
import { CompendiumService } from '../scripts/services/compendium-service.js';
import { PartyInventoryService } from '../scripts/services/party-inventory-service.js';
import { WishlistService } from '../scripts/services/wishlist-service.js';

function fixture() {
  const player = { id: 'player', active: true, isGM: false };
  const hero = { id: 'hero', uuid: 'Actor.hero', name: 'Hero', type: 'character', hasPlayerOwner: true, system: { currency: { gp: 10 } }, testUserPermission: user => user.id === player.id };
  const party = { id: 'party', uuid: 'Actor.party', name: 'Party', type: 'group', system: { members: [{ actor: hero.id }], currency: { gp: 20 } }, testUserPermission: () => false };
  const outsider = { ...party, id: 'outsider', uuid: 'Actor.outsider', name: 'Other Party', system: { members: [], currency: { gp: 30 } } };
  const actors = Object.assign([hero, party, outsider], { get(id) { return this.find(actor => actor.id === id); }, party });
  globalThis.game = { user: player, actors, users: Object.assign([player], { get(id) { return this.find(user => user.id === id); } }) };
  return { player, hero, party, outsider };
}

test('party members get Shopper/Payer/Sender access without Group ownership; outsiders do not', () => {
  const { player, hero, party, outsider } = fixture();
  assert(canUseActorInventory(party, player));
  assert(!canUseActorInventory(outsider, player));
  assert.deepEqual(ActorService.getShopperActors().map(actor => actor.id), ['party', 'hero']);
  assert.deepEqual(ActorService.getFundingActors().map(actor => actor.id), ['party', 'hero']);
  assert(PartyInventoryService.needsGM(party));
  party.system.members = [{ actor: hero }]; assert(canUseActorInventory(party, player));
  party.system.members = [{ uuid: hero.uuid }]; assert(canUseActorInventory(party, player));
  party.system.members = []; assert(!canUseActorInventory(party, player));
});

test('party GM checkout validates membership, forwards the real requester, and resolves once', async t => {
  const { player, hero, party, outsider } = fixture();
  game.user = { id: 'gm', isGM: true };
  let buys = 0, sells = 0;
  t.mock.method(CompendiumService, 'buyCart', async data => { assert.equal(data.requestingUser, player); assert.equal(data.actor, party); assert.equal(data.fundingActor, hero); buys++; return { status: 'completed' }; });
  t.mock.method(ActorService, 'sellCart', async (actor, items, options) => { assert.equal(actor, party); assert.equal(options.requestingUser, player); sells++; return { status: 'completed' }; });
  PartyInventoryService.requests.clear();
  const request = { requestId: 'once', type: 'buy', actorId: party.id, fundingActorId: hero.id, items: [{ packId: 'test', documentId: 'item', quantity: 1, priceCp: 10 }] };
  await PartyInventoryService.resolve(request, player.id); await PartyInventoryService.resolve(request, player.id);
  assert.equal(buys, 1);
  await PartyInventoryService.execute({ type: 'sell', actorId: party.id, items: [{ itemId: 'item', quantity: 1 }] }, player.id);
  assert.equal(sells, 1);
  await assert.rejects(PartyInventoryService.execute({ ...request, actorId: outsider.id }, player.id), /no longer a member/);
  await assert.rejects(PartyInventoryService.execute({ ...request, items: [...request.items, ...request.items] }, player.id), /Invalid party/);
  party.system.members = [];
  await assert.rejects(PartyInventoryService.execute(request, player.id), /no longer a member/);
  assert.equal(buys, 1);
});

test('non-owner party wishlists route through the GM and recheck membership', async t => {
  const { player, party } = fixture();
  let entries = [];
  party.getFlag = (_module, flag) => flag === 'isShop' ? false : entries;
  party.setFlag = async (_module, _flag, value) => { entries = value; };
  const handlers = new Map(), previousCore = globalThis.MorelordCore;
  t.after(() => { globalThis.MorelordCore = previousCore; });
  globalThis.MorelordCore = { socket: { createChannel: () => ({
    on: (name, handler) => handlers.set(name, handler),
    executeAsGM: async (name, data) => {
      game.user = { id: 'gm', isGM: true };
      try { return await handlers.get(name)(data, { senderUserId: player.id }); }
      finally { game.user = player; }
    }
  }) } };
  PartyInventoryService.initialize();
  const row = { uuid: 'Compendium.test.Item.example', name: 'Example' };
  assert(await WishlistService.add(row, party)); assert.equal(entries.length, 1);
  assert(!await WishlistService.add(row, party));
  assert(await WishlistService.remove(row.uuid, party)); assert.equal(entries.length, 0);
  party.system.members = [];
  await assert.rejects(WishlistService.add(row, party), /no longer a member/);
  assert.equal(entries.length, 0);
});
