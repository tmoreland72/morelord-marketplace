# Releasing Morelord Marketplace

Dispatch the **Release** workflow from the `main` branch after this workflow file is on `main`. The workflow runs `.github/workflows/release.yml` on `ubuntu-latest` with PowerShell. It does not run in-Foundry tests.

The workflow does not dispatch documentation. `release.config.json` has no `documentationWebsiteRepository`, and `release.ps1` requests a documentation deployment only when that key is set. A normal release publishes Foundry and the website from `release.ps1` after the GitHub Release. `publish_only` publishes the website with `-WebsiteOnly`, then Foundry with `-FoundryOnly`. The unit-test step lists `test/*.test.mjs` with `Get-ChildItem` and passes each path to `node --test`.

The workflow does not list archive files. `release.ps1` packages `release.config.json` `requiredPaths`, plus any `optionalPaths` that exist, and checks the zip against those required paths. Marketplace required paths are `module.json`, `README.md`, `CHANGELOG.md`, `scripts`, `styles`, `templates`, and `docs`. Optional paths are `data`, `assets`, `lang`, `LICENSE`, and `LICENSE.md`. `release-notes/` stays out of the zip.

## Secrets

Both secrets are already stored under **Settings > Secrets and variables > Actions**:

| Secret | Used for |
| --- | --- |
| `RELEASE_PUBLISH_TOKEN` | `morelordgaming.com` release feed |
| `FOUNDRY_RELEASE_TOKEN` | Foundry VTT package listing |

The workflow passes those values only as environment variables on the publish step. It does not write a `.env` file and it does not print the values. The job stops with a clear error when either secret is empty.

`GITHUB_TOKEN` is provided by Actions. The workflow sets `GH_TOKEN` from it so `release.ps1` can commit, tag, push, and create the GitHub Release. The workflow grants `contents: write` and commits as `github-actions[bot]`. Branch protection on `main` must allow that bot to push commits and tags.

## Inputs

| Input | Default | Effect |
| --- | --- | --- |
| `bump` | `patch` | Used only when `version` is empty and `publish_only` is false |
| `version` | empty | Explicit `x.y.z`. When set, `bump` is ignored |
| `publish_only` | false | Skip the version bump, tag, and GitHub Release. Publish that version to the website and then to Foundry |

With `module.json` at `0.12.1` and no explicit version, the bumps are:

| `bump` | Next version |
| --- | --- |
| `patch` | `0.12.2` |
| `minor` | `0.13.0` |
| `major` | `1.0.0` |

`publish_only` without `version` uses the version already in `module.json`. It does not increment it. `publish_only` with `version` publishes that exact version. `module.json` on `main` must already equal that version, and the `v` tag must already exist on `origin`. `publish_only` with version `0.12.1` sends the existing 0.12.1 release to the website feed and the Foundry listing.

A normal release still needs `release-notes/RELEASE-NOTES-<version>.md` and `docs/README.md` frontmatter for that version before the dispatch. `release.ps1` creates the commit, tag, GitHub Release, website record, and Foundry release.

## Changelog

Per-version release notes live in `release-notes/RELEASE-NOTES-<version>.md`. Those files are excluded from release archives. Every release maintains a cumulative root `CHANGELOG.md`: newest version first, `#`/`##`/`###` headings with a space after `#`, `- ` bullets, and no `---` horizontal rules. `release.ps1` rebuilds that file from `release-notes/RELEASE-NOTES-*.md` before it stages the archive, keeps the user-facing sections under `## What Changed`, and omits `## Verification` and other internal test sections. It then commits `CHANGELOG.md` with `module.json` (`git add -- module.json CHANGELOG.md`).

`release.config.json` lists `CHANGELOG.md` in `requiredPaths`, so the file is copied to the root of the release `.zip`. In-Foundry changelog viewers and GitHub users read that packaged file.

`-ValidateOnly` rebuilds `CHANGELOG.md` when it differs and does not commit, tag, or publish. When `CHANGELOG.md` is already up to date, the rebuild leaves the Git worktree unchanged. `-DryRun` does not modify `CHANGELOG.md`.

## Morelord Core and tests

When `publish_only` is false, the workflow checks out the public repository `tmoreland72/morelord-core` and moves it beside this repository so unit tests can import Core. Checkout uses the Actions `GITHUB_TOKEN` already granted to the job. Morelord Core is public, so that token can read the repository and no cross-repo secret is required.

The owner is `tmoreland72`, the same value as `githubOwner` in `release.config.json`. The raw manifest is `https://raw.githubusercontent.com/tmoreland72/morelord-core/main/module.json`.

This repository has no `package.json`. The workflow runs on Node 20 under PowerShell. Node 20 treats a quoted `test/*.test.mjs` argument as a literal path, so the test step lists those files with `Get-ChildItem` and passes each path to `node --test`. Tests import Core from the sibling path, including `scripts/ui/disabled-reason.js`.

`publish_only` skips that checkout and skips the unit tests.

## Local equivalents

Website-only and Foundry-only publishing are separate script invocations. They do not commit, tag, or create a GitHub Release.

```powershell
$env:RELEASE_PUBLISH_TOKEN = '<token>'
./release.ps1 -Version 0.12.1 -WebsiteOnly
$env:FOUNDRY_RELEASE_TOKEN = '<token>'
./release.ps1 -Version 0.12.1 -FoundryOnly
```
