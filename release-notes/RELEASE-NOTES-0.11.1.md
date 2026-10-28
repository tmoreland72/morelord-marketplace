# Morelord Marketplace 0.11.1

## What Changed

### Improvements

- Marketplace now follows the D&D system's **Configure Sources** setting for every compendium it touches. A compendium you turned off there is not browsed, searched, purchased, previewed, approved, or opened from an item link, and it is never used as a fallback. Shop filters only narrow that list.
- Buying, checkout and GM approval all load the item through the same check. A copy of an SRD item in an enabled world compendium can no longer be bought while the SRD compendium is turned off.
- Prefab shops draw only from compendiums Configure Sources allows.
- Opening an item link from a compendium that is turned off shows "That compendium is not allowed" instead of the item.
- A shop's saved buy list entry that points at a turned-off compendium is ignored, and Shop Manager no longer lists it. The saved shop data is left in place, so turning the compendium back on brings the entry back.
- The setup help now points to **D&D5e → Configure Sources** instead of a separate Marketplace source list.

## Compatibility

Verified on Foundry VTT 14.369. Requires Morelord Core 0.7.0 or newer. The Foundry minimum remains 14.

## Verification

`node --test` on the Marketplace tests: 49 passed, 0 failed. The changelog check runs against the changelog entry the release script writes. New tests cover a turned-off item compendium not being indexed or opened, an SRD copy in an enabled world compendium not loading while the SRD compendium is off, and the name fallback not matching a turned-off compendium.