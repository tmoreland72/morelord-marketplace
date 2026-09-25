# Manual shop items regression

Run `node --test test/*.test.mjs` for policy, checkout rejection, catalog exclusion, and restock-target checks.

In verified Dev1 only, as a GM with Shop Manager access and at least two enabled priced items:

```js
const { runInGameTests } = await import('./modules/morelord-core/scripts/testing/in-game.js');
const { manualShopItemsCheck } = await import('./modules/morelord-marketplace/scripts/testing/manual-shop-items.mjs');
console.log(await runInGameTests({ checks: [manualShopItemsCheck] }));
```

The check creates and removes its own shop, uses a transient Item, and closes its own manager. It never changes campaign actors or inventory. Live execution passed in verified Dev1 on Foundry 14.368 / D&D5e 6.0.3 during the September 24 release checks; see Core's test/in-game-reports/2026-09-25-pending-release-validation.json.

Manual follow-up in Dev1: add/remove purchase-list entries, verify a player's Sell tab and checkout, sell out a manual listing and restock, toggle manual-only off, and check narrow/200% zoom layouts with real Foundry/Core styles.

Offline rendering: `node tools/verify-manual-shop-ui.mjs` renders the actual manager template with installed Foundry/Core styles, checks both themes at 1240px and 700px window widths inside a 1400px viewport, and captures screenshots under `test/ui-reports`. It verifies purchase rows, editor overflow, the search label, and checkbox interaction. This is not live Foundry or 200% zoom verification.
