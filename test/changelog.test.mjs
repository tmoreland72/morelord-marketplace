import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const lines = changelog.split(/\r?\n/);
const manifest = JSON.parse(readFileSync(path.join(root, "module.json"), "utf8"));
const releaseConfig = JSON.parse(readFileSync(path.join(root, "release.config.json"), "utf8"));
const releaseScript = readFileSync(path.join(root, "release.ps1"), "utf8");

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
  const noteVersions = readdirSync(path.join(root, "release-notes"))
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
  assert.match(changelog, /^## 0\.11\.0\n\n### Improvements\n\n- Morelord Marketplace and Manage Marketplace Shops open from Morelord Tools/m);
  assert.match(changelog, /## 0\.10\.3\n\n### Fixed\n\n- Buying filled containers/m);
  assert.match(changelog, /## 0\.9\.0\n\nThis release improves Marketplace browsing/);
  assert.match(changelog, /### Changes\n\n- Added a paginated Buy catalog/);
});

test("release workflow lists test files in PowerShell and publishes through release.ps1", () => {
  const workflow = readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
  assert.match(workflow, /\$tests = @\(Get-ChildItem -LiteralPath test -Filter \*\.test\.mjs -File\)/);
  assert.match(workflow, /node --test @\(\$tests\.FullName\)/);
  assert.equal(workflow.includes("node --test test/*.test.mjs"), false);
  assert.equal(workflow.includes("repository_dispatch"), false);
  assert.equal(workflow.includes("product-docs-updated"), false);
  assert.equal(Object.hasOwn(releaseConfig, "documentationWebsiteRepository"), false);
  assert.match(workflow, /\/release\.ps1 -Version \$env:RELEASE_VERSION -WebsiteOnly\r?\n\s+\.\/release\.ps1 -Version \$env:RELEASE_VERSION -FoundryOnly/);
  assert.match(workflow, /^        run: \.\/release\.ps1 -Version \$env:RELEASE_VERSION$/m);
  assert.match(releaseScript, /if \(-not \[string\]::IsNullOrWhiteSpace\(\$DocumentationWebsiteRepository\)\)/);
  assert.match(releaseScript, /function Publish-FoundryRelease/);
  assert.match(releaseScript, /function Publish-WebsiteRelease/);
});

test("release packaging commits and requires the root changelog", () => {
  assert.equal(releaseConfig.requiredPaths.includes("CHANGELOG.md"), true);
  assert.match(releaseScript, /function Update-Changelog/);
  assert.match(releaseScript, /git add -- module\.json CHANGELOG\.md/);
  assert.match(releaseScript, /\[switch\]\$ValidateOnly/);
  assert.match(releaseScript, /\[switch\]\$FoundryOnly/);
});

test("Windows file URL roots keep a single drive letter", () => {
  const testUrl = new URL("file:///E:/repo/test/changelog.test.mjs");
  const pathnameRoot = new URL("..", testUrl).pathname;
  assert.equal(path.win32.resolve("E:\\repo", pathnameRoot, "CHANGELOG.md"), "E:\\E:\\repo\\CHANGELOG.md");

  const windowsRoot = fileURLToPath(new URL("..", testUrl), { windows: true });
  assert.equal(path.win32.join(windowsRoot, "CHANGELOG.md"), "E:\\repo\\CHANGELOG.md");
  assert.equal(path.win32.join(windowsRoot, "release-notes"), "E:\\repo\\release-notes");
});
