import { canUseActorInventory } from '../../../morelord-core/scripts/ui/actor-participation.js';
import { MODULE_ID } from '../constants.js';
import { ActorService } from './actor-service.js';
import { CompendiumService } from './compendium-service.js';

/** A GM performs Group mutations without granting players document ownership. */
export class PartyInventoryService {
  static requests = new Map();
  static initialize() {
    this.channel = globalThis.MorelordCore.socket.createChannel(`${MODULE_ID}.party-inventory`);
    // ponytail: serialize party transactions globally; use actor locks if throughput matters.
    this.channel.on('checkout', (data, context) => this.resolve(data, context.senderUserId), { serialize: `${MODULE_ID}.party-inventory` });
    this.channel.on('wishlist', async ({ actorId, row, uuid }, context) => {
      const user = game.users.get(context.senderUserId), actor = game.actors.get(actorId);
      if (!game.user.isGM || !user?.active || actor?.type !== 'group' || actor.getFlag?.(MODULE_ID, 'isShop') || !canUseActorInventory(actor, user)) throw new Error('You are no longer a member of this party.');
      const { WishlistService } = await import('./wishlist-service.js');
      return row ? WishlistService.add(row, actor) : WishlistService.remove(uuid, actor);
    }, { serialize: `${MODULE_ID}.party-inventory` });
    this.channel.on('wishlist', async ({ actorId, row, uuid }, context) => {
      const user = game.users.get(context.senderUserId), actor = game.actors.get(actorId);
      if (!game.user.isGM || !user?.active || actor?.type !== 'group' || actor.getFlag?.(MODULE_ID, 'isShop') || !canUseActorInventory(actor, user)) throw new Error('You are no longer a member of this party.');
      const { WishlistService } = await import('./wishlist-service.js');
      return row ? WishlistService.add(row, actor) : WishlistService.remove(uuid, actor);
    }, { serialize: `${MODULE_ID}.party-inventory` });
  }
  static needsGM(...actors) {
    return !game.user.isGM && actors.some(actor => actor?.type === 'group' && !actor.testUserPermission?.(game.user, 'OWNER'));
  }
  static checkout(data) {
    return this.channel.executeAsGM('checkout', { ...data, requestId: foundry.utils.randomID(24) });
  }
  static resolve(data, userId) {
    if (typeof data?.requestId !== 'string' || !data.requestId) throw new Error('Invalid party transaction request.');
    const key = `${userId}:${data.requestId}`;
    if (!this.requests.has(key)) {
      // ponytail: retain 1000 recent requests per GM session; persistent receipts if reload recovery is needed.
      if (this.requests.size >= 1000) this.requests.delete(this.requests.keys().next().value);
      this.requests.set(key, this.execute(data, userId));
    }
    return this.requests.get(key);
  }
  static async execute({ type, actorId, fundingActorId, items, shopId }, userId) {
    if (!game.user.isGM) throw new Error('A connected Game Master is required for party inventory.');
    const user = game.users.get(userId), actor = game.actors.get(actorId);
    const fundingActor = type === 'buy' ? game.actors.get(fundingActorId) : actor;
    if (!user?.active || !['buy', 'sell'].includes(type) || !canUseActorInventory(actor, user) || !canUseActorInventory(fundingActor, user)
      || actor.getFlag?.(MODULE_ID, 'isShop') || fundingActor.getFlag?.(MODULE_ID, 'isShop')
      || ![actor, fundingActor].some(candidate => candidate.type === 'group')
      || ![actor, fundingActor].every(candidate => ['character', 'group'].includes(candidate.type))) throw new Error('You are no longer a member of this party or cannot use the selected inventory.');
    if (!Array.isArray(items) || !items.length || items.some(line => !line || !Number.isInteger(line.quantity) || line.quantity < 1)
      || new Set(items.map(line => type === 'buy' ? `${line.packId}:${line.documentId}` : line.itemId)).size !== items.length) throw new Error('Invalid party transaction cart.');
    if (type === 'buy') return CompendiumService.buyCart({ actor, fundingActor, items, requestingUser: user });
    const { ShopService } = await import('./shop-service.js');
    const shop = shopId ? ShopService.getShop(shopId) : null;
    if (shopId && !shop) throw new Error('This shop no longer exists.');
    return ActorService.sellCart(actor, items, { shop, requestingUser: user });
  }
}
