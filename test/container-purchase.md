# Container purchase regression

Run `node tools/verify-container-purchase.mjs` with Foundry available locally.
The launcher checks the join page and loaded world are Dev1 before running Core's shared runner.
Enable buying and a compendium containing Explorer's Pack with actual container contents.

The module-owned `containerPurchaseCheck` in `scripts/testing/container-purchase.mjs`
buys one pack through the direct purchase path and two through the approved-cart path.
It verifies the source's complete item count, separate top-level packs, valid owned
containment links, and the exact listed-price currency deduction. It deletes its
disposable actor in cleanup without changing source documents or world settings.
The launcher saves `test/in-game-reports/container-purchase.json`.

Offline: `node --test test/*.test.mjs`. Container preparation checks cover repeated
copies and the ordinary-item fallback for systems without D&D5e's import helper.

October 17, 2026: passed all five shared-runner checks in verified Dev1 on
Foundry 14.369 / D&D5e 6.0.3. The native Explorer's Pack purchase and two-copy
approved cart preserved all contents, owned container links, and exact currency
deductions. Evidence: `test/in-game-reports/container-purchase.json`.
Shop checkout and a real player approval interaction were not separately exercised live.
The launcher supports the current `userId` login field and the older `username` field.
