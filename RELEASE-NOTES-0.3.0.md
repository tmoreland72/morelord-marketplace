# Morelord Marketplace 0.3.0

## Premium access integration

- Added Morelord Core as a required shared account and entitlement dependency.
- GM approval for purchases and sales now requires the `marketplace.gm-approvals` product feature.
- Standard users retain all normal buying and selling functionality.
- Premium settings remain visible but are locked when access is unavailable.
- Added account connection, access status, and manual refresh controls to Marketplace configuration.
- Uses Morelord Core's cached entitlement grace period during temporary website outages.
- Existing settings and transaction data are never deleted when premium access expires.

## API

The Marketplace API now exposes:

```js
game.modules.get("morelord-marketplace")?.api.hasPremiumApprovals();
await game.modules.get("morelord-marketplace")?.api.refreshEntitlements();
```
