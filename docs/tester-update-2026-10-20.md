# Tester update verification — October 20, 2026

## Changes

- Rare shinies: fixed league identity, 1/1,024 odds per species, +3 basketball skills capped at 100; canonical shiny sprites for IDs 1–1025. Identity follows the league through development, trades, archives, and later seasons. Old saves without an identity remain unchanged.
- Solo franchise rookie draft: exhaustive CPU recruiting was blocking the browser main thread for long batches. Actions and recommendations now run in a worker with progress, cancellation, recoverable errors, and atomic save replacement after completion.
- Restart: visible header actions in both solo and local modes retain confirmation and independent saves.
- Correct shiny evaluation in scouting, team impact, optimized lineups, CPU decisions, live arcade profiles, trades, training, and management screens. Readable offseason checklist and rookie panel in the clubhouse theme.

## Completed verification

- 84 tests across 15 focused files passed: shiny rules and persistence, policies, draft evaluation, hosted assets, management UI, restart, and worker cancellation/error/save handling.
- 33 existing draft/recommendation/rookie tests across five files passed.
- 22 full franchise persistence tests passed (649.33 seconds), including historical saves, completed seasons, corrupted archives, trades, and future years.
- Production build with `/pokemon-basketball/` base passed, including TypeScript. Existing large-chunk advisory remains.
- Browser: a complete 60-pick solo rookie draft unlocked season 2; an additional full modern-rules draft verified cancellation and retry. Restart cancellation preserved the game. Shiny artwork, gold identification, and boosted ratings were checked visually.
- Read-only implementation review found no remaining concrete critical shiny or rookie-draft defect after follow-up fixes.

Temporary fixture screens and their server were removed. Browser screenshots are stored in the local visualization directory for this date. Interrupted earlier broad test runs are not counted as passes. Browsers without Web Workers retain the synchronous compatibility fallback; the responsiveness fix targets modern browsers with workers.
