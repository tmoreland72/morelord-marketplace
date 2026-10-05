# Morelord Marketplace 0.10.1 — Container Transfer Fix

## What Changed

### Fixed

- Transferring a container now brings all its contents, including nested containers, and preserves their organization in the recipient's inventory. Emptying containers first is no longer required.
- Items selected both individually and through a container move only once. Cart totals include contained quantities, and the transaction receipt lists every item moved.
- Transfers recheck container contents before changing the sender's inventory. Recovery restores containment after a failed transfer; items can still be sent independently from inside containers.

## Compatibility and verification

Requires Morelord Core 0.4.0 or later; no Core update is needed. Verified in Dev1 on Foundry VTT 14.368 with D&D5e 6.0.3. All 35 automated Marketplace checks and the shared design-system check passed. Live checks cover nested contents, overlapping selections, standalone content transfers, partial-deletion recovery, existing GM/player routing, both themes, and narrow layouts.
