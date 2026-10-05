import { assert } from '../../../morelord-core/scripts/testing/in-game.js';
import { canUseActorInventory } from '../../../morelord-core/scripts/ui/actor-participation.js';
import { TransferService } from '../services/transfer-service.js';

export const partyMembershipCheck = {
  id: 'morelord-marketplace.party-membership',
  async run() {
    assert(game.user.isGM, 'Run as GM with a connected player in Dev1.');
    const player = game.users.find(user => user.active && !user.isGM);
    assert(player, 'A connected player is required.');
    const actors = [], messages = new Set(game.messages.map(message => message.id));
    try {
      const hero = await Actor.create({ name: 'Party access regression character', type: 'character', ownership: { [player.id]: 3 } }); actors.push(hero);
      const party = await Actor.create({ name: 'Party access regression Group', type: 'group', ownership: { default: 2 }, system: { members: [{ actor: hero.id }] } }); actors.push(party);
      assert(!party.testUserPermission(player, 'OWNER') && canUseActorInventory(party, player), 'Membership permits inventory use without Group ownership.');
      const [item] = await party.createEmbeddedDocuments('Item', [{ name: 'Party access regression item', type: 'loot', system: { quantity: 2 } }]);
      await TransferService.execute({ actorId: party.id, targetId: hero.id, items: [{ itemId: item.id, quantity: 1 }] }, player.id);
      assert(party.items.get(item.id).system.quantity === 1 && hero.items.find(entry => entry.name === item.name)?.system.quantity === 1, 'Member transfer updates both real inventories.');
      assert(!party.testUserPermission(player, 'OWNER'), 'Transfer does not grant Group ownership.');
      await party.update({ 'system.members': [] });
      assert(!canUseActorInventory(party, player), 'Removing membership revokes access.');
      let denied = false;
      try { await TransferService.execute({ actorId: party.id, targetId: hero.id, items: [{ itemId: item.id, quantity: 1 }] }, player.id); } catch { denied = true; }
      assert(denied && party.items.get(item.id).system.quantity === 1, 'Stale requests are rejected without mutation.');
    } finally {
      for (const message of game.messages) if (!messages.has(message.id) && message.content.includes('Party access regression')) await message.delete();
      for (const actor of actors.reverse()) await actor.delete();
    }
  }
};
