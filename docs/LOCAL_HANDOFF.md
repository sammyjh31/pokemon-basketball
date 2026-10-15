# Local and cloud handoff — 2026-10-15

The previously completed cloud game was pushed to GitHub and pulled locally at `9bcf9ab`. Development now continues in `/Users/sam/Documents/PokeBBall`, with validated work committed and pushed to `main` at `https://github.com/sammyjh31/pokemon-basketball.git`.

## This update

- Adapted All-22's compact dark interface, condensed headings, gold accents, sidebar controls, and pixel-sprite nameplates to a five-player basketball court.
- Kept the original basketball ratings, deterministic season engine, 151-player pool, two draft modes, and browser-local save format.
- Added randomize/clear, name or Pokédex-number search, pixel/artwork selection, shareable lineup URLs, and PNG court export.
- Shared lineup imports ask before replacing a saved draft or season. Cancel keeps the current run; accepting preserves aggregate personal records. The query is consumed after the choice so later refreshes restore edits.
- Bundled 151 pixel sprites and local font subsets; gameplay needs no network API or secrets.
- Updated mode names in the existing Playwright suite to match the visible UI.

## Validation

- `npm test -- --run`: **59 tests passed** across seven files.
- `npm run build`: passed TypeScript checking and production bundling on Node 24.19.0.
- `git diff --check`: passed.
- All 151 new PNG signatures and SHA-256 manifest entries verified.
- In-app browser: imported lineup; canceled and accepted replacement of a saved season; searched by name and number; filtered types; replaced players; swapped with keyboard; changed sprite style; cleared/randomized; exhausted two rerolls; drafted all five challenge slots; simulated 82 results; restored the same 24–58 season after refresh.
- Browser layout checks: 1440×1000, 768×1024, 390×844, and 320×844. No horizontal overflow at checked widths. Informative text contrast check returned no failures below 4.5:1. No browser warning/error logs.
- Independent read-only review completed. Fixed saved-run replacement, stale clipboard fallback, and button hover contrast findings.

## Remaining verification limits

- Browser security denied the PNG download test. The export implementation builds, but a successful downloaded image was **not verified**. No retry or workaround was attempted. Test Save image manually in a browser that permits the download when ready.
- The standalone Playwright CLI suite was updated but **not rerun locally** in this desktop session; browser interactions used the supported in-app browser. The cloud baseline had passed that suite. A future environment with authorized browser automation can run `npm run test:e2e`.
- Public deployment, accounts, additional generations, benches, and playoffs are outside this update.

## Continue

1. Pull `main` with `git pull --ff-only origin main` before making changes. Do not overwrite uncommitted work in either environment.
2. Use Node ≥24.15 (`.nvmrc`: 24.19.0), then `npm ci`.
3. Start the local preview with `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`. Cloud previews may require `--host 0.0.0.0`.
4. Run the relevant checks, commit, and push `main` before switching environments. If both environments changed it, fetch and reconcile without force-pushing.

See [design QA](../design-qa.md), [screenshots](design/), and [README](../README.md). Browser saves do not travel with Git; lineup URLs carry only the five player IDs.
