# Local and cloud handoff — 2026-10-15

Development continues in `/Users/sam/Documents/PokeBBall`, synchronized to `main` at `https://github.com/sammyjh31/pokemon-basketball.git`. The earlier All-22 visual adaptation is baseline `a99197b`; this update builds on it.

## This update

- Exactly eight unique Pokémon: five starters and three reserves, required in both modes. Two challenge rerolls remain. Free builder includes auto-fill bench, swaps, randomize/clear, and eight-ID share links; old five-ID links still load.
- 20 basketball skills with nonlinear base stats, capped size, mass/mobility tradeoffs, small type effects, weak role requirements, team composition, coaching, stamina, and rotation weighting. Full scouting reports and skill/position sorting help choose players.
- Five coaching styles and three rotation emphases; 240 regulation minutes, up to 40 each, plus 25 per overtime.
- Seeded possession simulation derives scores from recorded production. Shooting, turnovers, assists, offensive/defensive rebounds, final-free-throw rebounds, steals, and blocks feed actual player statistics.
- Sortable per-game/totals tables, all-eight game box scores, and six explicitly team-only awards.
- New opponents tuned against actual simulated rosters. Removed the old uncalibrated forecast UI; Rating Edge compares overall ratings without claiming probability.
- v2 saves validate by deterministic replay. v1 drafts retain existing choices; completed seasons are archived with original scores and records. Frozen legacy ratings, opponents, and engine validate old results. **Future simulation changes must preserve model-version compatibility.**
- PNG export region includes the court, bench, and coaching. Successful download remains unverified (see below).

## Validation

- `npm test -- --run`: 83 unit/component tests passed across 12 files, including conservation, coaching effects, actual-engine strong/weak roster behavior and overtime, migration/tampering, reveal gating, awards, sorting, and focus.
- TypeScript and production build checked with bundled Node 24.19.0; `.nvmrc` pins the same version.
- In-app browser: eight-pick challenge season; free builder, auto-fill, coaching changes, scouting report; sortable season totals/per-game view; six awards; regulation and overtime box scores; Escape/focus restoration; completed 75–7 season unchanged after refresh. The user’s existing 67–15 v1 season also restored as an archived recap with no save warning; archived drafts hide unusable bench controls.
- Desktop1440×1000, mobile390×844, narrow320×844: no document overflow; table scrolling stays inside its panel; mobile box-score dialog fits; all eight rows and six award cards present. Browser warning/error log empty.
- Independent review completed. Fixed bench-only reset warning, partial-v1 choice preservation, export-region omission, forecast mismatch, final-free-throw rebounding, and actual-engine test coverage.

## Verification limits and scope

- A previous browser security decision denied the PNG download test. No retry or workaround was made. Downloaded PNG output remains unverified.
- Standalone Playwright tests were updated for eight slots and bench auto-fill but were not executed in this desktop session; interactive checks used the supported in-app browser. An environment with authorized automation can run `npm run test:e2e`.
- Opponents are aggregate teams, not drafted Pokémon rosters. No league/career awards, substitution timeline, injuries, foul-outs, playoffs, multiplayer, or public deployment.

## Continue

1. Pull `main` with `git pull --ff-only origin main` before editing; preserve uncommitted work in either environment.
2. Node ≥24.15, tested24.19.0; `npm ci` after dependency changes. No new dependencies in this update.
3. Local preview: `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`. Cloud may need `--host 0.0.0.0` and its forwarded URL.
4. Run appropriate checks, commit, and push before switching environments. Reconcile concurrent changes without force-pushing.

Browser saves stay in their browser. Share links carry eight player IDs only. QA used `localhost:5173`, a separate origin from the user's `127.0.0.1:5173` save.

See [design QA](../design-qa.md), [screenshots](design/), [README](../README.md), and the [implementation plan](superpowers/plans/2026-10-15-eight-player-simulation.md).
