# Local and cloud handoff — 2026-10-15

Development continues in `/Users/sam/Documents/PokeBBall`, synchronized to `main` at `https://github.com/sammyjh31/pokemon-basketball.git`. This update builds on the eight-player simulation baseline `9f8118c`.

## This update

- Exactly eight Pokémon per club: five starters and three reserves. Gen I–II supplies 251 species, including 240 non-legendary/mythical species. All 240 league roster spots are unique; the user's selections are reserved first.
- Other clubs use a seeded snake draft with positional and coaching preferences. Starter picks choose their best vacant role, avoiding a league-wide PG-first talent bias.
- Thirty clubs share an 82-round, 1,230-game schedule. Every team plays all 29 opponents and has exactly 41 home and 41 away games. Both sides' points, player statistics and standings derive from the same events.
- Twenty skills plus nine advanced tools feed actual five-player lineups, minute-by-minute rotations, fatigue/recovery, matchups, screens, five offensive play types, four defensive schemes, fouls/bonus/free throws, six-foul substitutions, late-game choices and overtime.
- League center: standings, all 240 player leaders, per-game/totals and qualified percentages, all team rosters/coaching, every game with both-team box scores, and cross-team player comparisons.
- Six league-wide awards with three finalists each, plus positionless All-League and All-Defense teams. Individual-team season totals remain separate.
- New state and simulation model 3. Frozen `legacy*` and `v2*` modules preserve completed older seasons. The first 151 factual records and existing assets remain unchanged. Saves retain summaries and aggregates; non-user boxes replay from seeds, keeping a sampled league around 740 KB.
- Simulation yields between rounds, reports progress, locks edits and rejects stale/duplicate application. Saved-league restoration also validates asynchronously before exposing the saved season or writing state.
- No new runtime dependencies, external gameplay APIs, accounts or secrets. All 251 portraits, 251 pixel sprites and fonts are local.

## Validation record

Final verification: **127 tests passed across 21 files**, TypeScript and Vite production build passed, and `git diff --check` passed. Unit tests cover shared-game conservation, uniqueness, schedule balance, seeded replay, global honors, compact saves, legacy migration, event arithmetic, tactics, fatigue, foul-outs, overtime, stronger/weak player behavior, stale completion, UI comparison/filtering/sorting and modal focus. Independent review has no remaining findings. Its two save findings were repaired: asynchronous restoration avoids blocking the first render, and valid shared-lineup imports over damaged saves can persist through simulation and refresh.

Browser QA uses `localhost:5173`, a separate origin from the user's `127.0.0.1:5173` save. The user's earlier-model 69–13 season and four challenge runs were observed intact. The old saved season clearly explains that a new run is required for league-wide features.

The final test league finished 21–61 and restored the identical result and awards after refresh with visible restoration progress. Verified league leader search, eight-player opponent rosters, cross-team comparison, game filtering, both-team box scores and award finalists. No document overflow at 1440, 390 or 320 pixels; no warning/error entries in the checked browser session. Final screenshots: `docs/design/league-awards-desktop.png` and `docs/design/league-awards-mobile.png`.

## Scope and verification limits

- No playoffs, careers, injuries, generations after II, accounts, multiplayer or public hosting.
- The clock uses 7.5-second ticks and one-minute substitution decisions. The simulation is statistical, not a spatial or fully officiated real-league simulator. Depleted rosters retain only enough disqualified players to remain five-on-five; subsequent fouls add a technical free throw.
- A previous browser security decision denied a PNG download test. No retry or workaround was made. Downloaded PNG output remains unverified.
- Standalone Playwright CLI tests were not executed in this desktop session; browser checks used the supported in-app browser. An environment with authorized automation can run `npm run test:e2e`.

## Continue

1. Pull `main` with `git pull --ff-only origin main` before editing; preserve uncommitted work in either environment.
2. Node ≥24.15, tested 24.19.0. Run `npm ci` after dependency changes. Local bundled Node is `/Users/sam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`.
3. Preview: `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`. Cloud may need `--host 0.0.0.0` and its forwarded URL.
4. Run appropriate checks, commit and push before switching environments. Reconcile concurrent work without force-pushing.
5. **Preserve simulation model 3 before changing any deterministic input or output.** Roster draft, schedule, event probabilities, profiles, aggregation and award formulas all affect replay validation. Future behavioral changes need a new model version and migration.

Browser saves stay in their browser. Shared links carry eight player IDs, not coaching or results. See [league formulas](LEAGUE_MODEL.md), [design QA](../design-qa.md), [screenshots](design/), [README](../README.md), and the [implementation plan](superpowers/plans/2026-10-15-league-simulation.md).
