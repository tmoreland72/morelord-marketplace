# Marketplace shared-component audit — September 11, 2026

Marketplace uses Core, but it is not yet entirely standardized. The customer-facing page now follows the suite's section structure. Shop Manager, catalog filters, and transaction cards still contain substantial custom presentation. This audit distinguishes completed fixes from remaining consolidation opportunities.

Reviewed the three application classes and templates, loaded tab partials, all three feature stylesheets, service boundaries, module manifest, Core's shared UI/services and design checker, and the Downtime section/render patterns. The supplied screenshot was unavailable. This is a source and template audit, not a live-world visual or transaction test.

## Completed fixes

| Area | Finding | Change |
| --- | --- | --- |
| Source names | Marketplace sent only book text to Core and kept separate pack fallback logic. Pack ownership, declared source books, and modern SRD identity could be lost. | Pass source, custom source, and pack to Core; remove Marketplace's duplicate fallback and generic-label rules. |
| MDT2 | The abbreviation had no readable fallback. | Resolve to **Mini-Dungeon Tome II**, matching the installed `foundry5emdt2` manifest. |
| Valda | The installed module declares `VSoS: VSOS.Title`; an unavailable translation leaked the key. | Core resolves the abbreviation and untranslated key to **Valda's Spire of Secrets**, while honoring an available translation. |
| Generic source data | Numeric and equipment-type labels could become source names. | Core ignores these labels and uses custom or pack metadata. |
| Shopper/payer | Controls were inside the market header in a card rather than their own section. | Add a separate shared surface below the header, with the standard title/subtitle/divider structure. Explain that sale proceeds go to the shopper. |
| Buy/Sell/Wishlist | Tabs used custom headings and undifferentiated content regions. | Give each tab its own `ml-surface ml-stack` and `ml-section-heading`, including Buy/Wishlist loading states. |
| Navigation | Bespoke tab chrome duplicated control styling and exposed no pressed state. | Use Core toolbar/buttons/accent and badges, with `aria-pressed` on the active choice. Existing actions and tab data remain intact. |
| Page layout | Local shell/window styles duplicated Core's layout. | Remove Marketplace shell/window duplicates and use Core's page layout and scroll-preserving render helper. |
| Settings | Root omitted `ml-app-shell` and repeated its settings class. | Use the shared shell and separate `ml-page-footer` for Save. |
| Shop configuration | Shop Manager recreated surface borders, padding, backgrounds, and stack layout. | Configuration panels now use `ml-surface ml-stack`; remove their duplicated skin. |
| Theme colors | Many borders and surfaces referenced Foundry's generic light/cool colors directly. | Use Core border, surface, and accent tokens at those sites. |
| Style leakage | Bare `button.primary` and `button.danger` rules could affect other applications. | Scope them to Marketplace. |
| Compact layout | Column-layout selectors retained a 260px flex basis; Sell's 235px cart inherited a 285px minimum. | Reset stacked selector basis and remove the conflicting Sell-cart minimum. |

The global product header is preserved. Existing unrelated working-tree changes were retained. No manifest version, release, or deployment was performed.

## Shared-service coverage

| Concern | Assessment |
| --- | --- |
| Application primitives | All three applications declare `ml-window`. Main page and Settings use shared shells; Shop Manager combines a shared shell with its own library/editor grid. |
| Sections and controls | Main sections and Shop Manager configuration surfaces use Core. Shared actions, badges, access cards, empty states, and native controls are already present. |
| Documentation | The main page action opens Core's documentation service. |
| Access/entitlements | `EntitlementService` delegates connection, tier, feature, and refresh operations to Core. Marketplace-specific feature keys appropriately stay local. |
| Locations/capabilities | Shop location access delegates to Core. Marketplace's stock/capability rules remain product-specific. |
| Source books | Fully routed through Core for catalog rows and source facets after this change. Tests cover pack metadata and edition preservation. |
| Scroll behavior | Core supplies page layout and page-scroll preservation. Existing per-panel memory remains for nested/horizontal pane positions. |
| User filtering | Transaction recipient and active-GM selection use Core's user list when available, as already present in this working tree. |
| Currency and pricing | Marketplace owns conversion, modifiers, reputation pricing, and updates. Core currently exposes no equivalent currency API; moving these merely to remove a local service would introduce a new shared contract. |
| Shopping actors | Local selection includes ownership, group support, shop-actor exclusion, and currency eligibility. Core's participation helpers serve a different purpose and are not a drop-in replacement. |
| Transactions/sockets | Reservation, approval, stock, and rollback workflows remain Marketplace services. Core's contextual socket service is not a demonstrated drop-in transaction transport. No financial behavior was changed in this UI/source-label pass. |

## Remaining audit findings

1. **Custom presentation remains in Shop Manager, filter rows, carts, and chat cards.** `marketplace-shops.css` contains multiple refinement blocks for the same selectors and literal spacing, colors, and sizes. The main page is more consistent now, but this is not a claim that all Marketplace styling has been centralized. Further consolidation should compare the actual library/editor and chat layouts in Foundry before deleting cascade layers.
2. **Narrow-window behavior needs live validation.** The Buy grid still specifies substantial filter/results/cart widths, and its media queries track viewport width rather than the resizable Foundry window. The corrected Sell-cart conflict is separate from this wider responsive-layout limitation.
3. **Actor identity presentation remains local.** Shopper/payer controls display native text options, and transaction cards generally display actor names. Core's `ui.actorIdentity` and select decoration are candidates for consistent portraits. Marketplace selects currently hold actor IDs; Core's decorator expects UUIDs, so applying it blindly would not resolve portraits correctly.
4. **Nested scroll memory still exists.** Main-page rendering now preserves Core's outer page position. Marketplace retains its panel-specific map, and Shop Manager has its own scroll handling. Remove these only after checking tab switching, stock refresh, and cart mutations against Core's flow conversion.
5. **Escaping has a local implementation.** `TransactionService.escape` duplicates HTML escaping offered by Foundry. It is currently used extensively in chat markup; replacing it should retain tests for names, attribute values, and apostrophes.
6. **Legacy template files appear unused.** `buy-tab copy.hbs`, `filters.hbs`, `search-tab.hbs`, `item-row.hbs`, and `currency-display.hbs` are not referenced by the current scripts or templates. They were retained rather than deleted during the layout change; confirm external consumers before removing them.
7. **Dependency metadata is too permissive.** Marketplace declares Core minimum `0.1.0`, while its current implementation requires newer APIs such as `sources.resolveBookLabel`. Set the minimum to a verified released Core version when packaging the two modules together. A version was not invented from an unreleased working tree.

## Validation

- Core: all 30 Node tests pass.
- Marketplace: all four capability/source integration tests pass.
- Source regression coverage includes MDT2, VSoS, untranslated/localized VSOS.Title, owning module metadata, numeric/generic labels, custom sources, and SRD 5.1/5.2.
- Main templates rendered with the installed Foundry Handlebars library for Buy, Sell, and Wishlist contexts; Shop Manager and Settings compiled.
- Marketplace passes Core's design-system boundary checker. That checker verifies boundaries, not visual equivalence.
- JavaScript syntax checks and whitespace checks pass for the changes.
- Still unverified in a live Foundry world: visual appearance, actual viewport resizing, focus and scroll during interactive rerenders, and Buy/Sell checkout behavior. No real transactions were executed.
