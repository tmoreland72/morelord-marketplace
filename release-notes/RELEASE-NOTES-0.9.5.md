# Morelord Marketplace 0.9.5

## What Changed

### Improvements

- Use Core page and keyed-panel scroll preservation in Marketplace and Shop Manager.
- Show Core actor portraits in shopper and payer selectors while retaining stored actor IDs.
- Require packaged product documentation and validate its landing-page version.

### Fixed

- Correct manual versions, Core requirements, Buy/Sell cart instructions, and shop capability and wishlist guidance.
- Use Foundry's native HTML escaping utility and synchronize the release script with Core.
- Allow actor selectors to shrink within their shared portrait layout.

### Changed

- Require Morelord Core 0.3.6 or later for the shared UI services used by this release.

## Validation

- All 8 module tests pass; the shared design-system check passes across six feature modules.
- Live Foundry visual and interaction verification was not performed.
