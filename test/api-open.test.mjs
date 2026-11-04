import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("api.open forwards options to openMarketplace and returns its result", () => {
  const source = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
  const match = source.match(/open\(options\) \{\s*return this\.openMarketplace\(options\);\s*\}/);
  assert.ok(match);
  const open = new Function(`return function ${match[0]}`)();
  const options = { tab: "buy" };
  const result = { rendered: true };
  let received;
  const api = {
    openMarketplace(value) {
      received = value;
      return result;
    },
    open
  };

  assert.equal(typeof api.open, "function");
  assert.equal(api.open(options), result);
  assert.equal(received, options);
});
