# Morelord Marketplace 0.9.6

## What Changed

### Improvements

- Account connection, membership, and refresh controls appear in a separate Morelord Account section above Trading.

- Settings use Core headers, section headings, cards, responsive settings rows, badges, and footers; duplicated local settings styling has been removed.

- Marketplace Settings uses Core’s standard page footer so Save stays visible below the scrolling settings.

- Shopping As and Paying From use Core’s shared character eligibility: player-owned characters and character members of the primary party. Existing actor permissions, currency checks, and Group inventory choices still apply.

- Added Default Buy Rate for global purchases, defaulting to 1 and requiring a value of 1 or higher. Shop pricing remains independent.
- Added clear headers above the buy and sell rate inputs using Core shared stacked fields.

### Changed

- Require Morelord Core 0.3.7 or later for the shared components and character eligibility used by this release.

## Validation

- All 10 module tests pass; Core's design-system check passes across six feature modules.
- Live Foundry visual and multiplayer verification was not performed.
