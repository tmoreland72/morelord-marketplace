import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.foundry = { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: Base => Base } } };
const { ActorService } = await import('../scripts/services/actor-service.js');
test('shopping and funding use Core eligibility while preserving permissions and currency checks', () => {
  const actor = (id, player, owner, currency = true) => ({ id, uuid: 'Actor.' + id, name: id, type: 'character', hasPlayerOwner: player, isOwner: owner, system: currency ? {currency: {gp: 10}} : {}, testUserPermission: () => owner });
  const owned = actor('Owned',true,true), companion = actor('Companion',false,false), outsider = actor('Outside',false,true), otherPlayer = actor('OtherPlayer',true,false), noCurrency = actor('NoCurrency',true,true,false);
  const group = { id: 'party', uuid: 'Actor.party', name: 'Party', type: 'group', system: {members: [{uuid: companion.uuid}],currency: {gp: 10}}, testUserPermission: () => true };
  const actors = [owned,companion,outsider,otherPlayer,noCurrency,group];actors.party=group;
  globalThis.game = {actors,user:{isGM:true}};
  assert.deepEqual(ActorService.getShopperActors().map(a=>a.id), ['party','Companion','NoCurrency','OtherPlayer','Owned']);
  assert.deepEqual(ActorService.getFundingActors().map(a=>a.id), ['party','Companion','OtherPlayer','Owned']);
  game.user.isGM=false;
  assert.deepEqual(ActorService.getShopperActors().map(a=>a.id), ['party','NoCurrency','Owned']);
  assert.deepEqual(ActorService.getFundingActors().map(a=>a.id), ['party','Owned']);
});
