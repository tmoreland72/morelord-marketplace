import { MODULE_ID } from "../constants.js";
import { CurrencyService } from "./currency-service.js";
import { PricingService } from "./pricing-service.js";
import { PurchaseEligibilityService } from "./purchase-eligibility-service.js";
import { ShopService } from "./shop-service.js";
import { CompendiumService } from "./compendium-service.js";

const SOCKET_NAME = `module.${MODULE_ID}`;
const REQUEST_TIMEOUT_MS = 30000;

export class ShopTransactionService {
  static pending = new Map();
  static initialized = false;
  static reservations = new Map();
  static reservationTotals = new Map();

  static initialize() {
    if (this.initialized) return;
    this.initialized = true;
    game.socket.on(SOCKET_NAME, payload => this.#onSocket(payload));
  }

  static #activeGmIds() {
    return game.users
      .filter(user => user.active && user.isGM)
      .map(user => user.id)
      .sort((a, b) => String(a).localeCompare(String(b)));
  }

  static async #onSocket(payload) {
    if (!payload || payload.module !== MODULE_ID) return;

    if (payload.kind === "shop-reservation-state") {
      this.reservationTotals.set(payload.shopId, { ...(payload.totals ?? {}) });
      window.dispatchEvent(new CustomEvent("ml-marketplace-shop-reservations", { detail: { shopId: payload.shopId } }));
      return;
    }

    if (payload.kind === "shop-inventory-changed") {
      window.dispatchEvent(new CustomEvent("ml-marketplace-shop-reservations", {
        detail: { shopId: payload.shopId, inventoryChanged: true }
      }));
      return;
    }

    if (payload.kind === "shop-reservation-request" && game.user.isGM) {
      if (payload.targetGmId && payload.targetGmId !== game.user.id) return;
      const reservationKey = `${payload.requestingUserId}:${payload.shopId}`;
      const quantities = Object.fromEntries(Object.entries(payload.quantities ?? {}).filter(([, qty]) => Number(qty) > 0));
      if (Object.keys(quantities).length) this.reservations.set(reservationKey, quantities);
      else this.reservations.delete(reservationKey);
      this.#broadcastReservationState(payload.shopId);
      return;
    }

    if (payload.kind === "shop-checkout-response" && payload.targetUserId === game.user.id) {
      const pending = this.pending.get(payload.requestId);
      if (!pending) return;
      this.pending.delete(payload.requestId);
      clearTimeout(pending.timeout);
      pending.resolve(payload.result);
      return;
    }

    if (payload.kind !== "shop-checkout-request" || !game.user.isGM) return;
    if (payload.targetGmId && payload.targetGmId !== game.user.id) return;

    let result;
    try {
      result = await this.#executeCheckout(payload);
    } catch (error) {
      console.error(`[${MODULE_ID}] Shop checkout failed`, error);
      result = { ok: false, error: error?.message ?? "The shop transaction failed." };
    }

    game.socket.emit(SOCKET_NAME, {
      module: MODULE_ID,
      kind: "shop-checkout-response",
      requestId: payload.requestId,
      targetUserId: payload.requestingUserId,
      result
    });
  }

  static #aggregateReservations(shopId, { excludeUserId = null } = {}) {
    const totals = {};
    for (const [reservationKey, quantities] of this.reservations.entries()) {
      const [userId, reservedShopId] = reservationKey.split(":");
      if (reservedShopId !== shopId || (excludeUserId && userId === excludeUserId)) continue;
      for (const [key, qty] of Object.entries(quantities ?? {})) totals[key] = (totals[key] ?? 0) + Number(qty || 0);
    }
    return totals;
  }

  static #broadcastReservationState(shopId) {
    if (!game.user.isGM) return;
    const totals = this.#aggregateReservations(shopId);
    this.reservationTotals.set(shopId, totals);
    game.socket.emit(SOCKET_NAME, { module: MODULE_ID, kind: "shop-reservation-state", shopId, totals });
    window.dispatchEvent(new CustomEvent("ml-marketplace-shop-reservations", { detail: { shopId } }));
  }

  static getReserved(shopId, stockKey) {
    return Math.max(0, Number(this.reservationTotals.get(shopId)?.[stockKey] ?? 0));
  }

  static broadcastInventoryChanged(shopId) {
    if (!game.user.isGM || !shopId) return;
    game.socket.emit(SOCKET_NAME, {
      module: MODULE_ID,
      kind: "shop-inventory-changed",
      shopId
    });
    window.dispatchEvent(new CustomEvent("ml-marketplace-shop-reservations", {
      detail: { shopId, inventoryChanged: true }
    }));
  }

  static async setReservation(shopId, quantities = {}) {
    if (!shopId) return;
    if (game.user.isGM) {
      const reservationKey = `${game.user.id}:${shopId}`;
      const clean = Object.fromEntries(Object.entries(quantities).filter(([, qty]) => Number(qty) > 0));
      if (Object.keys(clean).length) this.reservations.set(reservationKey, clean);
      else this.reservations.delete(reservationKey);
      this.#broadcastReservationState(shopId);
      return;
    }
    const targetGmId = this.#activeGmIds()[0] ?? null;
    if (!targetGmId) return;
    game.socket.emit(SOCKET_NAME, { module: MODULE_ID, kind: "shop-reservation-request", requestingUserId: game.user.id, targetGmId, shopId, quantities });
  }

  static async checkout({ shopId, actorId, fundingActorId, items, expectedRevision }) {
    if (game.user.isGM) {
      return this.#executeCheckout({
        requestingUserId: game.user.id,
        shopId,
        actorId,
        fundingActorId,
        items,
        expectedRevision
      });
    }

    const targetGmId = this.#activeGmIds()[0] ?? null;
    if (!targetGmId) {
      return { ok: false, error: "A Game Master must be connected to complete shop purchases." };
    }

    const requestId = foundry.utils.randomID();
    const resultPromise = new Promise(resolve => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        resolve({ ok: false, error: "The shop purchase timed out while waiting for the Game Master client." });
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, timeout });
    });

    game.socket.emit(SOCKET_NAME, {
      module: MODULE_ID,
      kind: "shop-checkout-request",
      requestId,
      requestingUserId: game.user.id,
      targetGmId,
      shopId,
      actorId,
      fundingActorId,
      items,
      expectedRevision
    });

    return resultPromise;
  }

  static async #executeCheckout({ requestingUserId, shopId, actorId, fundingActorId, items = [], expectedRevision }) {
    if (!game.user.isGM) throw new Error("Only a Game Master client may finalize a shop purchase.");

    const requester = game.users.get(requestingUserId);
    if (!requester) throw new Error("The requesting user is no longer available.");

    const shop = ShopService.getShop(shopId);
    const actor = game.actors.get(actorId);
    const fundingActor = game.actors.get(fundingActorId);
    if (!shop || !actor || !fundingActor) throw new Error("The shop, shopper, or funding actor could not be found.");

    if (Number(expectedRevision ?? shop.revision) !== Number(shop.revision ?? 1)) {
      throw new Error(`${shop.name} has changed since you opened it. Refresh the shop before purchasing.`);
    }

    const canUseActor = requester.isGM || actor.testUserPermission(requester, "OWNER");
    const canUseFunds = requester.isGM || fundingActor.testUserPermission(requester, "OWNER");
    if (!canUseActor || !canUseFunds) throw new Error("You do not have permission to use the selected actor or funds.");

    if (shop.allowBuying === false) throw new Error(`${shop.name} is not currently selling items.`);
    const reputation = ShopService.getReputationTier(shop);
    if (reputation.buyModifier === null) throw new Error(`${shop.name} will not trade with you at your current reputation.`);

    const requestedLines = items
      .map(line => ({
        packId: String(line.packId ?? ""),
        documentId: String(line.documentId ?? ""),
        quantity: Math.max(0, Math.floor(Number(line.quantity ?? 0))),
        quotedPriceCp: Math.max(0, Math.floor(Number(line.priceCp ?? 0)))
      }))
      .filter(line => line.packId && line.documentId && line.quantity > 0);
    if (!requestedLines.length) throw new Error("The shopping cart is empty.");

    const allowedPackIds = CompendiumService.getAllowedPackIds();
    const prepared = [];
    let totalCp = 0;
    const stockNeeded = new Map();

    for (const line of requestedLines) {
      if (!allowedPackIds.includes(line.packId)) throw new Error("A shop item source is no longer allowed by Marketplace.");
      const pack = game.packs.get(line.packId);
      if (!pack) throw new Error("A shop item source is no longer available.");
      const item = await pack.getDocument(line.documentId);
      if (!item || !PurchaseEligibilityService.isPurchasable(item)) throw new Error("An item in the cart is no longer available for purchase.");

      const basePriceCp = PricingService.getItemPriceCp(item);
      const livePriceCp = PricingService.getBuyPriceCp(basePriceCp, shop);
      if (livePriceCp === null) throw new Error(`${shop.name} will not trade with you at your current reputation.`);
      if (livePriceCp !== line.quotedPriceCp) throw new Error(`${item.name}'s price changed. Refresh the shop and review your cart.`);

      // Normalize the full document with the same helpers used to build the
      // visible catalog. Do not depend on a second GM-side catalog cache: the
      // requesting client and GM can have differently hydrated pack indexes.
      const typeKey = CompendiumService.normalize(item.type);
      const row = {
        packId: line.packId,
        documentId: line.documentId,
        uuid: `Compendium.${line.packId}.Item.${line.documentId}`,
        typeKey,
        subtypeKey: CompendiumService.getSubtypeKey(typeKey, item.system ?? {}),
        rarityKey: CompendiumService.normalizeRarity(item.system?.rarity)
      };
      if (!ShopService.entryPassesShop(row, shop, line.packId)) {
        throw new Error(`${item.name} is not sold by ${shop.name}. Refresh the shop and review your cart.`);
      }

      const key = ShopService.stockKey(row);
      stockNeeded.set(key, (stockNeeded.get(key) ?? 0) + line.quantity);
      totalCp += livePriceCp * line.quantity;
      prepared.push({ item, row, key, quantity: line.quantity, unitPriceCp: livePriceCp });
    }

    for (const line of prepared) {
      const stock = ShopService.getStock(shop, line.row);
      const needed = stockNeeded.get(line.key) ?? 0;
      const reservedByOthers = this.#aggregateReservations(shopId, { excludeUserId: requestingUserId })[line.key] ?? 0;
      if (Number.isFinite(stock) && stock - reservedByOthers < needed) throw new Error(`${line.item.name} no longer has enough unreserved stock. Refresh the shop.`);
    }

    const originalCurrencyCp = CurrencyService.currencyToCp(CurrencyService.getCurrency(fundingActor));
    if (originalCurrencyCp < totalCp) throw new Error("The selected funds are no longer sufficient for this purchase.");

    const stockSnapshot = foundry.utils.deepClone(shop.stock ?? {});
    const createdIds = [];
    const ownedUuidsByKey = new Map();
    try {
      for (const line of prepared) {
        const sources = [];
        for (let i = 0; i < line.quantity; i += 1) sources.push(line.item.toObject());
        const created = await actor.createEmbeddedDocuments("Item", sources);
        createdIds.push(...created.map(document => document.id));
        if (created[0]?.uuid) ownedUuidsByKey.set(line.key, created[0].uuid);
      }

      await CurrencyService.setCurrency(fundingActor, originalCurrencyCp - totalCp);

      const nextShop = ShopService.getShop(shopId);
      if (Number(nextShop.revision ?? 1) !== Number(shop.revision ?? 1)) {
        throw new Error(`${shop.name} changed while the purchase was being processed. Refresh the shop and try again.`);
      }
      nextShop.stock = { ...(nextShop.stock ?? {}) };
      for (const line of prepared) {
        if (!ShopService.isLimited(nextShop, line.row)) continue;
        const current = Math.max(0, Number(nextShop.stock[line.key] ?? 0));
        nextShop.stock[line.key] = Math.max(0, current - line.quantity);
      }
      const savedShop = await ShopService.saveShop(nextShop, { bumpRevision: true });

      this.reservations.delete(`${requestingUserId}:${shopId}`);
      this.#broadcastReservationState(shopId);

      return {
        ok: true,
        totalCp,
        remainingCp: originalCurrencyCp - totalCp,
        shopRevision: savedShop.revision,
        stock: foundry.utils.deepClone(savedShop.stock ?? {}),
        items: prepared.map(line => ({
          name: line.item.name,
          img: line.item.img,
          uuid: ownedUuidsByKey.get(line.key) ?? null,
          quantity: line.quantity,
          totalPriceCp: line.unitPriceCp * line.quantity
        }))
      };
    } catch (error) {
      try {
        if (createdIds.length) await actor.deleteEmbeddedDocuments("Item", createdIds);
      } catch (rollbackError) {
        console.error(`[${MODULE_ID}] Failed to rollback purchased items`, rollbackError);
      }
      try {
        await CurrencyService.setCurrency(fundingActor, originalCurrencyCp);
      } catch (rollbackError) {
        console.error(`[${MODULE_ID}] Failed to rollback purchase currency`, rollbackError);
      }
      try {
        const rollbackShop = ShopService.getShop(shopId);
        rollbackShop.stock = stockSnapshot;
        await ShopService.saveShop(rollbackShop);
      } catch (rollbackError) {
        console.error(`[${MODULE_ID}] Failed to rollback shop stock`, rollbackError);
      }
      throw error;
    }
  }
}
