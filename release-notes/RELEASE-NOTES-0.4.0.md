# Morelord Marketplace v0.4.0

## New Features

- Added support for the Morelord Marketplace `purchasable` item flag.
- Items can now explicitly opt out of appearing in the Marketplace Buy catalog.
- Added compatibility with Morelord Craftworks purchasing rules.

## Purchasing Rules

- Items with no `purchasable` flag continue to use normal Marketplace behavior.
- Items with `purchasable: true` remain available for purchase when they have a valid price.
- Items with `purchasable: false` are excluded from the Buy catalog even when they have a monetary value.
- The `purchasable` flag affects buying only; flagged items may still be sold when they have a valid value.

## Reliability

- Purchasable status is checked while building the Buy catalog.
- Purchasable status is revalidated when a purchase is made.
- GM-approved purchases revalidate purchasable status before completing the transaction.
- Prevents stale Marketplace data from bypassing purchasing restrictions.
