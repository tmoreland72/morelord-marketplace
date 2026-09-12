import test from "node:test";
import assert from "node:assert/strict";
import { ShopService } from "../scripts/services/shop-service.js";
import { WishlistService } from "../scripts/services/wishlist-service.js";

const rows = Array.from({ length: 8 }, (_, index) => ({
  uuid: `Compendium.test.items.Item.${index}`, packId: "test.items", documentId: String(index), rarityKey: "common"
}));
const shop = {
  inventoryMode: "limited", inventoryOverrides: { limited: [] },
  randomInventory: { enabled: true, allowDuplicates: true, counts: { common: 6 } }
};

test("wishlist items can be missed entirely with duplicates enabled", t => {
  t.mock.method(WishlistService, "getUuids", () => new Set([rows[0].uuid, rows[1].uuid]));
  t.mock.method(Math, "random", () => 0.99);
  t.mock.method(ShopService, "randomStockQuantity", () => 1);
  const stock = ShopService.buildRandomStock(shop, rows);
  assert.equal(stock[ShopService.stockKey(rows[0])], undefined);
  assert.equal(stock[ShopService.stockKey(rows[1])], undefined);
  assert.equal(stock[ShopService.stockKey(rows[7])], 6);
  assert.equal(Object.values(stock).reduce((a, b) => a + b, 0), 6);
});

test("without duplicates, counts select distinct products and exclude manual stock", t => {
  t.mock.method(WishlistService, "getUuids", () => new Set([rows[0].uuid]));
  t.mock.method(Math, "random", () => 0.99);
  t.mock.method(ShopService, "randomStockQuantity", () => 1);
  const stock = ShopService.buildRandomStock({
    ...shop, inventoryOverrides: { limited: [rows[1].uuid] },
    randomInventory: { ...shop.randomInventory, allowDuplicates: false }
  }, rows);
  assert.equal(Object.keys(stock).length, 6);
  assert.equal(stock[ShopService.stockKey(rows[0])], undefined);
  assert.equal(stock[ShopService.stockKey(rows[1])], undefined);
});

test("wishlist weighting is a modest 25% boost across the full draw range", t => {
  t.mock.method(WishlistService, "getUuids", () => new Set([rows[0].uuid]));
  t.mock.method(ShopService, "randomStockQuantity", () => 1);
  let sample = 0;
  t.mock.method(Math, "random", () => (sample + 0.5) / 8250);
  const totals = Object.fromEntries(rows.map(row => [ShopService.stockKey(row), 0]));
  const singleDraw = { ...shop, randomInventory: { ...shop.randomInventory, counts: { common: 1 } } };
  for (; sample < 8250; sample += 1) {
    const stock = ShopService.buildRandomStock(singleDraw, rows);
    totals[Object.keys(stock)[0]] += 1;
  }
  assert.equal(totals[ShopService.stockKey(rows[0])], 1250);
  for (const row of rows.slice(1)) assert.equal(totals[ShopService.stockKey(row)], 1000);
});

test("duplicates allow requested draws when the eligible catalog is small", t => {
  t.mock.method(WishlistService, "getUuids", () => new Set());
  t.mock.method(Math, "random", () => 0.5);
  t.mock.method(ShopService, "randomStockQuantity", () => 1);
  assert.deepEqual(ShopService.buildRandomStock(shop, rows.slice(0, 1)), { "test.items:0": 6 });
});
