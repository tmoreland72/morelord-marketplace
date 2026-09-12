import test from "node:test";
import assert from "node:assert/strict";
import { CompendiumService } from "../scripts/services/compendium-service.js";
import { resolveBookLabel } from "../../morelord-core/scripts/services/source-book-service.js";

test("catalog sources retain pack ownership, custom source, and SRD edition", () => {
  globalThis.game = { modules: new Map(), system: {}, i18n: { localize: value => value } };
  globalThis.MorelordCore = { sources: { resolveBookLabel } };
  const pack = { collection: "valda.items", metadata: { packageName: "valda" } };
  game.modules.set("valda", { flags: { dnd5e: { sourceBooks: { VSoS: "VSOS.Title" } } } });
  assert.equal(CompendiumService.getSourceBook({}, pack), "Valda's Spire of Secrets");
  assert.equal(CompendiumService.getSourceBook({ book: "VSoS" }, pack), "Valda's Spire of Secrets");
  assert.equal(CompendiumService.getSourceBook({ book: "Items", custom: "MDT2" }, pack), "Mini-Dungeon Tome II");
  assert.equal(CompendiumService.getSourceBook("Items", { collection: "dnd5e.equipment24" }), "System Reference Document 5.2");
  assert.equal(CompendiumService.getSourceBook({ book: "", custom: "AAW", revision: 1, rules: "2014" }, { collection: "foundry5emdt2.items" }), "Mini-Dungeon Tome II");
});
