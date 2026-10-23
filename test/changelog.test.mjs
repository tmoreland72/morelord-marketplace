import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
const lines = changelog.split(/\r?\n/);
const manifest = JSON.parse(readFileSync(join(root, "module.json"), "utf8"));
const releaseConfig = JSON.parse(readFileSync(join(root, "release.config.json"), "utf8"));
const releaseScript = readFileSync(join(root, "release.ps1"), "utf8");

function versionValue(version) {
  return version.split(".").map(part => Number(part));
}

test("root changelog uses the module title and BBMM heading rules", () => {
  assert.equal(lines[0], `# ${manifest.title} Changelog`);
  assert.equal(changelog.includes("\r"), false);
  assert.equal(changelog.endsWith("\n"), true);
  assert.equal(changelog.endsWith("\n\n"), false);
  for (const [index, line] of lines.entries()) {
    if (/^#{1,6}/.test(line)) {
      assert.match(line, /^#{1,6} \S/, `heading needs a space at line ${index + 1}`);
    }
    assert.equal(/^\s*-{3,}\s*$/.test(line), false, `horizontal rule at line ${index + 1}`);
    assert.equal(/^\s*[*+]\s+/.test(line), false, `bullet must use '- ' at line ${index + 1}`);
  }
});

test("changelog versions are every release note, newest first, without internal sections", () => {
  const noteVersions = readdirSync(join(root, "release-notes"))
    .map(name => /^RELEASE-NOTES-(\d+\.\d+\.\d+)\.md$/.exec(name)?.[1])
    .filter(Boolean)
    .sort((left, right) => {
      const a = versionValue(left);
      const b = versionValue(right);
      for (let index = 0; index < 3; index += 1) {
        if (a[index] !== b[index]) return b[index] - a[index];
      }
      return 0;
    });
  const changelogVersions = lines.filter(line => line.startsWith("## ")).map(line => line.slice(3));
  assert.deepEqual(changelogVersions, noteVersions);
  assert.equal(changelog.includes("## What Changed"), false);
  assert.equal(changelog.includes("## Verification"), false);
  assert.equal(changelog.includes("## Validation"), false);
  assert.equal(changelog.includes("## Compatibility"), false);
  assert.equal(changelog.includes("## Installation"), false);
  assert.equal(changelog.includes("All 44 automated Marketplace tests passed"), false);
  assert.equal(changelog.includes("Install Marketplace using its manifest URL"), false);
  assert.equal(changelog.includes("Marketplace tests cover wishlist weighting"), false);
  assert.match(changelog, /^## 0\.10\.3\n\n### Fixed\n\n- Buying filled containers/m);
  assert.match(changelog, /## 0\.9\.0\n\nThis release improves Marketplace browsing/);
  assert.match(changelog, /### Changes\n\n- Added a paginated Buy catalog/);
});

test("release packaging commits and requires the root changelog", () => {
  assert.equal(releaseConfig.requiredPaths.includes("CHANGELOG.md"), true);
  assert.match(releaseScript, /function Update-Changelog/);
  assert.match(releaseScript, /git add -- module\.json CHANGELOG\.md/);
  assert.match(releaseScript, /\[switch\]\$ValidateOnly/);
});
