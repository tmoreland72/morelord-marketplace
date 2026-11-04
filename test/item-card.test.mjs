import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = {
  utils: { escapeHTML: value => String(value ?? "").replaceAll("<", "&lt;") }
};

const { TransactionService } = await import("../scripts/services/transaction-service.js");

function actor(name) {
  return { id: name, uuid: `Actor.${name}`, name };
}

function install({ itemCard } = {}) {
  const calls = [];
  const cards = [];
  globalThis.MorelordCore = itemCard
    ? { ui: { itemCard(options) { calls.push(options); return `<section class="ml-award-card">${options.totalLabel ?? ""}</section>`; } } }
    : { ui: {} };
  globalThis.game = {
    user: { id: "player", isGM: false },
    users: [],
    settings: { get: () => true }
  };
  globalThis.ChatMessage = {
    getSpeaker: () => ({ actor: "speaker" }),
    create: async data => {
      cards.push(data);
      return data;
    }
  };
  return { calls, cards };
}

const rope = { uuid: "Item.rope", name: "Rope", img: "rope.webp", quantity: 2, totalPriceCp: 100, unitPriceCp: 50 };
const buyer = actor("Ada");
const payer = actor("party");
const recipient = actor("Bea");

test("post, cart, purchase, and transfer cards call itemCard with prices and totals", async () => {
  const { calls, cards } = install({ itemCard: true });

  await TransactionService.post({
    type: "buy",
    actor: buyer,
    fundingActor: payer,
    itemName: "Rope",
    itemUuid: "Item.rope",
    quantity: 2,
    priceCp: 100
  });
  assert.deepEqual(calls[0].items, [{ uuid: "Item.rope", name: "Rope", quantity: 2, value: "1 gp" }]);
  assert.equal(calls[0].totalLabel, "Total: 1 gp");
  assert.equal(cards[0].content, calls[0] && `<section class="ml-award-card">${calls[0].totalLabel}</section>`);

  await TransactionService.postCart({
    type: "sell",
    actor: buyer,
    items: [rope],
    totalCp: 100
  });
  assert.deepEqual(calls[1].items, [{ uuid: "Item.rope", name: "Rope", img: "rope.webp", quantity: 2, value: "1 gp" }]);
  assert.equal(calls[1].totalLabel, "Total: 1 gp");

  await TransactionService.postCartPurchase({
    actor: buyer,
    fundingActor: payer,
    shop: { name: "Market" },
    items: [rope]
  });
  assert.deepEqual(calls[2].items, [{ uuid: "Item.rope", name: "Rope", img: "rope.webp", quantity: 2, value: "1 gp" }]);
  assert.equal(calls[2].totalLabel, "Total: 1 gp");
  assert.match(calls[2].bodyHTML, /Paid from:/);

  await TransactionService.postTransfer({
    actor: buyer,
    target: recipient,
    items: [{ uuid: "Actor.Ada.Item.rope", name: "Rope", quantity: 3 }, { uuid: "Actor.Ada.Item.torch", name: "Torch", quantity: 1 }]
  });
  assert.deepEqual(calls[3].items, [
    { uuid: "Actor.Ada.Item.rope", name: "Rope", quantity: 3 },
    { uuid: "Actor.Ada.Item.torch", name: "Torch", quantity: 1 }
  ]);
  assert.equal(calls[3].items.every(item => item.value == null), true);
  assert.equal(calls[3].totalLabel, "Items transferred: 4");
  assert.equal(cards.at(-1).content.includes("ml-award-card"), true);
});

test("approval cards call itemCard with line prices, the total, and approval actions", () => {
  const { calls } = install({ itemCard: true });
  const transaction = {
    id: "txn",
    type: "buy",
    actorName: "Ada",
    actorUuid: "Actor.Ada",
    fundingActorUuid: "Actor.party",
    fundingActorName: "party",
    itemName: "Cart",
    quantity: 3,
    totalPriceCp: 150,
    payload: { items: [rope, { uuid: "Item.torch", name: "Torch", quantity: 1, unitPriceCp: 50 }] }
  };

  const pending = TransactionService.renderPendingCard(transaction);
  assert.deepEqual(calls[0].items, [
    { uuid: "Item.rope", name: "Rope", img: "rope.webp", quantity: 2, value: "1 gp" },
    { uuid: "Item.torch", name: "Torch", quantity: 1, value: "1 ep" }
  ]);
  assert.equal(calls[0].totalLabel, "Total: 1 gp, 1 ep");
  assert.match(calls[0].actionsHTML, /data-ml-marketplace-approval-action="approve"/);
  assert.match(calls[0].actionsHTML, /data-ml-marketplace-approval-action="deny"/);
  assert.match(calls[0].actionsHTML, /data-ml-marketplace-transaction-id="txn"/);
  assert.match(calls[0].actionsHTML, /class="ml-marketplace-gm-actions"/);
  assert.match(calls[0].bodyHTML, /Awaiting GM Approval/);
  assert.equal(pending, `<section class="ml-award-card">${calls[0].totalLabel}</section>`);

  const single = { ...transaction, payload: {}, itemName: "Rope", itemUuid: "Item.rope", itemImg: "rope.webp", quantity: 1, totalPriceCp: 100 };
  TransactionService.renderProcessingCard(single, "GM");
  assert.deepEqual(calls[1].items, [{ uuid: "Item.rope", name: "Rope", img: "rope.webp", quantity: 1, value: "1 gp" }]);
  assert.equal(calls[1].totalLabel, "Total: 1 gp");

  TransactionService.renderResolvedCard(transaction, "approved", "GM", "Looks good");
  assert.deepEqual(calls[2].items, calls[0].items);
  assert.equal(calls[2].totalLabel, "Total: 1 gp, 1 ep");
  assert.match(calls[2].bodyHTML, /Resolved by GM/);
});

test("cards keep the previous markup when itemCard is unavailable", async () => {
  const { calls, cards } = install();
  assert.equal(typeof globalThis.MorelordCore.ui.itemCard, "undefined");

  await TransactionService.post({ type: "sell", actor: buyer, itemName: "Rope", quantity: 1, priceCp: 100 });
  await TransactionService.postCart({ type: "buy", actor: buyer, fundingActor: payer, items: [rope], totalCp: 100 });
  await TransactionService.postCartPurchase({ actor: buyer, shop: { name: "Market" }, items: [rope] });
  await TransactionService.postTransfer({ actor: buyer, target: recipient, items: [{ name: "Rope", uuid: "Item.rope", quantity: 2 }] });
  assert.equal(calls.length, 0);
  assert.match(cards[0].content, /ml-marketplace-card/);
  assert.match(cards[0].content, /sold/);
  assert.match(cards[1].content, /ml-marketplace-cart-transaction-card/);
  assert.match(cards[1].content, /Paid from:<\/strong> party/);
  assert.match(cards[2].content, /purchased from/);
  assert.match(cards[3].content, /Items transferred:<\/strong> 2/);

  const transaction = {
    id: "txn",
    type: "sell",
    actorName: "Ada",
    actorUuid: "Actor.Ada",
    fundingActorUuid: "Actor.Ada",
    itemName: "Rope",
    quantity: 1,
    totalPriceCp: 100
  };
  const pending = TransactionService.renderPendingCard(transaction);
  const processing = TransactionService.renderProcessingCard(transaction, "GM");
  const resolved = TransactionService.renderResolvedCard(transaction, "denied", "GM", "No");
  assert.match(pending, /ml-marketplace-approval-card/);
  assert.match(pending, /data-ml-marketplace-approval-action="approve"/);
  assert.match(pending, /data-ml-marketplace-transaction-id="txn"/);
  assert.match(processing, /ml-marketplace-status-processing/);
  assert.match(resolved, /ml-marketplace-approval-resolved/);
  assert.match(resolved, /Denied/);
  assert.equal(calls.length, 0);
});
