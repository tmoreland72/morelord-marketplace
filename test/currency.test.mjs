import test from "node:test";
import assert from "node:assert/strict";
import { CurrencyService } from "../scripts/services/currency-service.js";
import { PricingService } from "../scripts/services/pricing-service.js";
import * as coreCurrencyApi from "../../morelord-core/scripts/services/currency-service.js";

const { formatCp: coreFormatCp } = coreCurrencyApi;
globalThis.MorelordCore ??= {};
globalThis.MorelordCore.currency = coreCurrencyApi;

function actorWith(currency) {
  const actor = {
    name: "Aric",
    system: { currency: { ...currency } },
    updates: [],
    async update(change) {
      actor.updates.push(change);
      for (const [key, value] of Object.entries(change)) {
        actor.system.currency[key.split(".").pop()] = value;
      }
    }
  };
  return actor;
}

test("Marketplace reads Core api.currency", () => {
  const previous = globalThis.game;
  let used = false;
  const api = {
    ...coreCurrencyApi,
    currencyToCp(currency) {
      used = true;
      return coreCurrencyApi.currencyToCp(currency);
    }
  };
  globalThis.game = {
    modules: { get: id => id === "morelord-core" ? { api: { currency: api } } : undefined },
    settings: { get: () => false }
  };
  try {
    assert.equal(CurrencyService.currencyToCp({ gp: 2 }), 200);
    assert.equal(used, true);
    assert.equal(PricingService.getItemPriceCp({ system: { price: { value: 1, denomination: "gp" } } }), 100);
  } finally {
    if (previous === undefined) delete globalThis.game;
    else globalThis.game = previous;
  }
});

test("standard coin rates and purse totals stay in copper", () => {
  assert.equal(CurrencyService.currencyToCp({ cp: 1 }), 1);
  assert.equal(CurrencyService.currencyToCp({ sp: 1 }), 10);
  assert.equal(CurrencyService.currencyToCp({ ep: 1 }), 50);
  assert.equal(CurrencyService.currencyToCp({ gp: 1 }), 100);
  assert.equal(CurrencyService.currencyToCp({ pp: 1 }), 1000);
  assert.equal(CurrencyService.currencyToCp({ pp: 1, gp: 2, ep: 1, sp: 3, cp: 4 }), 1284);
  assert.equal(CurrencyService.currencyToCp({}), 0);
});

test("change-making spends platinum, gold, electrum, silver, then copper", () => {
  assert.deepEqual(CurrencyService.cpToCurrency(0), { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
  assert.deepEqual(CurrencyService.cpToCurrency(15), { pp: 0, gp: 0, ep: 0, sp: 1, cp: 5 });
  assert.deepEqual(CurrencyService.cpToCurrency(50), { pp: 0, gp: 0, ep: 1, sp: 0, cp: 0 });
  assert.deepEqual(CurrencyService.cpToCurrency(150), { pp: 0, gp: 1, ep: 1, sp: 0, cp: 0 });
  assert.deepEqual(CurrencyService.cpToCurrency(1250), { pp: 1, gp: 2, ep: 1, sp: 0, cp: 0 });
  assert.deepEqual(CurrencyService.cpToCurrency(1284), { pp: 1, gp: 2, ep: 1, sp: 3, cp: 4 });
  assert.deepEqual(CurrencyService.cpToCurrency(10000), { pp: 10, gp: 0, ep: 0, sp: 0, cp: 0 });
  assert.deepEqual(CurrencyService.cpToCurrency(-5), { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
});

test("price text keeps platinum and electrum", () => {
  assert.equal(CurrencyService.formatCp(0), "0 cp");
  assert.equal(CurrencyService.formatCp(15), "1 sp, 5 cp");
  assert.equal(CurrencyService.formatCp(50), "1 ep");
  assert.equal(CurrencyService.formatCp(99), "1 ep, 4 sp, 9 cp");
  assert.equal(CurrencyService.formatCp(150), "1 gp, 1 ep");
  assert.equal(CurrencyService.formatCp(400), "4 gp");
  assert.equal(CurrencyService.formatCp(1000), "1 pp");
  assert.equal(CurrencyService.formatCp(1250), "1 pp, 2 gp, 1 ep");
  assert.equal(CurrencyService.formatCp(10000), "10 pp");
  assert.equal(CurrencyService.formatCp(1284), "1 pp, 2 gp, 1 ep, 3 sp, 4 cp");
  assert.equal(coreFormatCp(1000), "10 gp");
  assert.equal(coreFormatCp(50), "5 sp");
  assert.notEqual(CurrencyService.formatCp(1000), coreFormatCp(1000));
  assert.notEqual(CurrencyService.formatCp(50), coreFormatCp(50));
});

test("item prices round to copper and unknown denominations use the gold rate", () => {
  assert.equal(PricingService.getItemPriceCp({ system: { price: { value: 12, denomination: "gp" } } }), 1200);
  assert.equal(PricingService.getItemPriceCp({ system: { price: { value: 1.5, denomination: "gp" } } }), 150);
  assert.equal(PricingService.getItemPriceCp({ system: { price: { value: 0.5, denomination: "gp" } } }), 50);
  assert.equal(PricingService.getItemPriceCp({ system: { price: { value: 2.4, denomination: "cp" } } }), 2);
  assert.equal(PricingService.getItemPriceCp({ system: { price: { value: 10.5, denomination: "sp" } } }), 105);
  assert.equal(PricingService.getItemPriceCp({ system: { price: { value: 1, denomination: "ep" } } }), 50);
  assert.equal(PricingService.getItemPriceCp({ system: { price: { value: 1, denomination: "pp" } } }), 1000);
  assert.equal(PricingService.getItemPriceCp({ system: { price: { value: 3, denomination: "foo" } } }), 300);
  assert.equal(PricingService.getItemPriceCp({ system: { price: 12 } }), 1200);
  assert.equal(CurrencyService.formatCp(PricingService.getItemPriceCp({ system: { price: { value: 0.5, denomination: "gp" } } })), "1 ep");
  assert.equal(CurrencyService.formatCp(PricingService.getItemPriceCp({ system: { price: { value: 12, denomination: "gp" } } })), "1 pp, 2 gp");
});

test("sell values floor after the rate and never round a positive sale to zero", () => {
  globalThis.game = { settings: { get: () => false } };
  try {
    assert.equal(PricingService.getSellPriceCp(1000, null, 0.4), 400);
    assert.equal(PricingService.getSellPriceCp(101, null, 0.4), 40);
    assert.equal(PricingService.getSellPriceCp(1, null, 0.4), 1);
    assert.equal(PricingService.getSellPriceCp(0, null, 0.4), 0);
    assert.equal(CurrencyService.formatCp(PricingService.getSellPriceCp(1000, null, 0.4)), "4 gp");
    assert.equal(CurrencyService.formatCp(PricingService.getSellPriceCp(101, null, 0.4)), "4 sp");
    assert.equal(CurrencyService.formatCp(PricingService.getSellPriceCp(1, null, 0.4)), "1 cp");
    assert.equal(CurrencyService.formatCp(PricingService.getSellPriceCp(0, null, 0.4)), "0 cp");
  } finally {
    delete globalThis.game;
  }
});

test("purse updates, affordance, and short funds keep the current results", async () => {
  const actor = actorWith({ gp: 1, sp: 15 });
  assert.equal(CurrencyService.canAfford(actor, 250), true);
  assert.equal(CurrencyService.canAfford(actor, 251), false);
  assert.equal(CurrencyService.getCurrencyDisplay(actor), "2 gp, 1 ep");
  await assert.rejects(() => CurrencyService.deductCurrency(actor, 251), /Insufficient funds\./);
  assert.equal(actor.updates.length, 0);
  await CurrencyService.deductCurrency(actor, 100);
  assert.deepEqual(actor.updates.at(-1), {
    "system.currency.pp": 0,
    "system.currency.gp": 1,
    "system.currency.ep": 1,
    "system.currency.sp": 0,
    "system.currency.cp": 0
  });
  assert.equal(CurrencyService.getCurrencyDisplay(actor), "1 gp, 1 ep");
  await CurrencyService.addCurrency(actor, 50);
  assert.equal(CurrencyService.currencyToCp(CurrencyService.getCurrency(actor)), 200);
  assert.equal(CurrencyService.formatCp(200), "2 gp");
  await CurrencyService.setCurrency(actor, 1250);
  assert.equal(CurrencyService.getCurrencyDisplay(actor), "1 pp, 2 gp, 1 ep");
});
