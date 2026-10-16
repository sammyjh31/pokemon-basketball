# Coach portraits

32 local PNGs, keyed by the stable IDs in `src/game/trainerCoaches.ts`.

- `manifest.json` records original source URLs, source pages, stated artist credits, pixel-art status, dimensions and SHA-256 hashes. Downloaded 2026-10-16; all image bytes are unchanged from their sources.
- `credits.html` provides player-facing attribution, linked from the coach draft and app footer. Preserve all named artist credits when updating assets; the Showdown source requests attribution and no editing without permission.
- 28 trainer sprites come from Pokémon Showdown. Four anime identities not present individually in that catalog use Bulbagarden Archives images: Gary Oak (not Blue), Jessie, James and Delia Ketchum (not a generic game mother).
- No runtime image requests leave the app origin. `CoachPortrait` uses contained images, pixel rendering for sprites, reserved dimensions, lazy loading and initials if an image fails.
- Character images remain the property of their respective rights holders; source attribution does not imply a grant of rights.
