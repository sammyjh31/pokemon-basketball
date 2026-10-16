# Local and cloud handoff — 2026-10-15

Development continues in `/Users/sam/Documents/PokeBBall`, synchronized to `main` at `https://github.com/sammyjh31/pokemon-basketball.git`. The league update was `36f760a`, and playoffs were `8a1257a`; franchise mode builds on both. A concurrent arcade-design documentation commit was preserved.

## Franchise update

- After the Finals, **Continue as franchise** archives the existing league as Year 1. All 30 eight-player rosters persist, with 240 unique species. Later years use fresh seeds and the same 82-game season and best-of-seven playoffs.
- Offseason one-for-one trades are evaluated by the other club using best-position ability and roster fit. The preview explains acceptance/rejection; successful trades update both rosters and a permanent transaction log. Careers and past honors keep their original attribution.
- Start the next year, then swap starters/reserves and choose coaching. Drafting and arbitrary species replacement are disabled in franchise mode. Later years do not increment challenge records. Ending the franchise requires an explicit confirmation explaining the loss of its history.
- League-wide careers show separate regular-season and postseason totals/averages, shooting percentages from combined attempts, game highs, double/triple doubles and player-of-game counts. Search/filter/sort and individual honors show awards, All-League/All-Defense selections, Finals MVPs and championship rings.
- History retains every year's standings, rosters, league honors, champion, Finals result and Finals MVP. Only the active year retains replayable game boxes. Archiving is idempotent; live career additions stop once that year is archived.
- The v3 save key/root gains franchise model 1; fixed-roster seasons use regular-season model 4 and playoff model 1. Only the active season replays on load. Archived records receive structural, arithmetic and cross-reference validation. Corrupt extensions preserve original bytes until an explicit new action. Ordinary model 3 and older saves remain compatible.
- Lifecycle actions and validation share limits of 1,000 seasons and 10,000 trades. Save quota failures remain visible. Development refresh now avoids rerunning mount-time restoration or writing unchanged idle-tab state over newer progress.

Verification: **214 tests passed across 34 files**, including lifecycle/uniqueness, fair trade evaluation, two-season fixed-roster replay, career accounting, corruption handling, UI flows and an idle-preview persistence regression. Production build and TypeScript passed; Vite reports a non-blocking 503.7 KB main-chunk size advisory. The test runner uses one worker because concurrent league replays caused older UI tests to miss their existing time limits; no timeouts were raised. Independent review's archive-boundary and keyboard-focus findings were reproduced and fixed.

Browser QA used `localhost:5173`, separate from the user's original save. Traded Vaporeon to Pallet for Venomoth, refreshed, started Year 2, swapped Sneasel into PG and chose Run & gun, then refreshed again. The final QA Year 2 finished 26–56; Cinnabar beat Pewter 4–2 in an 85-game postseason, with Tyranitar Finals MVP. Entering the offseason and reloading retained both years, all rosters, the trade, Vaporeon's 4,604 points across 164 games, Furret's Year 2 Sixth Player award and Tyranitar's championship/Finals MVP. No page overflow at 1440, 390 or 320px. No warning/error logs after the final reload. The user's separate-origin 69–13 season and four challenge attempts remain intact. Screenshots: `docs/design/franchise-history-desktop.jpg` and `franchise-offseason-mobile.jpg`.

## Postseason update

- The top 16 league-wide enter a fixed 15-series bracket. All rounds are best of seven, with the higher seed hosting games 1, 2, 5 and 7. Seeds use wins, point differential, then team ID; winners advance without reseeding.
- Advance one slate, one round or all remaining playoffs. All modes reproduce identical games. Teams missing qualification or eliminated can still follow the entire bracket.
- Separate 128-player postseason leaders support per-game/totals, sorting, search and team filtering. Select any series for its games and both-team boxes. Selection focuses and scrolls to the details; Back to bracket returns to the same series.
- Champion and Finals MVP appear after the Finals. MVP uses only the champion's Finals production and efficiency; integer-tenths ranking prevents floating-point tie errors. Displayed averages use only Finals games.
- Optional `run.playoffs` with independent model 1 preserves regular-season model 3. Existing completed league saves can start immediately. Partial/full postseason restores use bounded replay (at most 105 games). Corrupt extensions recover the verified regular season without overwriting original save bytes until a new action.
- Async work blocks duplicate advances and resets, cancels on unmount, and applies only to the originating run. Regular-season standings, statistics, awards and challenge counters remain unchanged.
- Fixed a reveal timing race: an immediate Skip reveal now remains honored even if the animation's initialization effect runs afterward.

Postseason browser QA on `localhost:5173`: resumed eight games after refresh, advanced the first round to 45 games, finished the 89-game postseason and refreshed again. Cherrygrove won 4–2 over Littleroot; Charizard was Finals MVP (33.3 PPG, 10.3 RPG, 5.5 APG). The final game was 128–121, with eight players and 240 minutes in each box. The regular-season record remained 21–61. Postseason Charizard totals were 906 points in 27 games, separate from his Finals averages. No document overflow at 1440, 390 or 320px, including the narrow game dialog; checked logs contained no warnings/errors. Evidence: `playoffs-bracket-desktop.png`, `playoffs-champion-mobile.png`, `playoffs-box-score.png` under `docs/design/`.

Postseason verification: **164 tests passed across 27 files**; TypeScript, production build and diff whitespace checks passed. Independent review's only finding (MVP tie precision) was reproduced and repaired. The full suite's reveal timing failure also has a dedicated passing regression.

## League update

- Exactly eight Pokémon per club: five starters and three reserves. Gen I–II supplies 251 species, including 240 non-legendary/mythical species. All 240 league roster spots are unique; the user's selections are reserved first.
- Other clubs use a seeded snake draft with positional and coaching preferences. Starter picks choose their best vacant role, avoiding a league-wide PG-first talent bias.
- Thirty clubs share an 82-round, 1,230-game schedule. Every team plays all 29 opponents and has exactly 41 home and 41 away games. Both sides' points, player statistics and standings derive from the same events.
- Twenty skills plus nine advanced tools feed actual five-player lineups, minute-by-minute rotations, fatigue/recovery, matchups, screens, five offensive play types, four defensive schemes, fouls/bonus/free throws, six-foul substitutions, late-game choices and overtime.
- League center: standings, all 240 player leaders, per-game/totals and qualified percentages, all team rosters/coaching, every game with both-team box scores, and cross-team player comparisons.
- Six league-wide awards with three finalists each, plus positionless All-League and All-Defense teams. Individual-team season totals remain separate.
- New state and simulation model 3. Frozen `legacy*` and `v2*` modules preserve completed older seasons. The first 151 factual records and existing assets remain unchanged. Saves retain summaries and aggregates; non-user boxes replay from seeds, keeping a sampled league around 740 KB.
- Simulation yields between rounds, reports progress, locks edits and rejects stale/duplicate application. Saved-league restoration also validates asynchronously before exposing the saved season or writing state.
- No new runtime dependencies, external gameplay APIs, accounts or secrets. All 251 portraits, 251 pixel sprites and fonts are local.

## League update validation record

Final verification: **127 tests passed across 21 files**, TypeScript and Vite production build passed, and `git diff --check` passed. Unit tests cover shared-game conservation, uniqueness, schedule balance, seeded replay, global honors, compact saves, legacy migration, event arithmetic, tactics, fatigue, foul-outs, overtime, stronger/weak player behavior, stale completion, UI comparison/filtering/sorting and modal focus. Independent review has no remaining findings. Its two save findings were repaired: asynchronous restoration avoids blocking the first render, and valid shared-lineup imports over damaged saves can persist through simulation and refresh.

Browser QA uses `localhost:5173`, a separate origin from the user's `127.0.0.1:5173` save. The user's earlier-model 69–13 season and four challenge runs were observed intact. The old saved season clearly explains that a new run is required for league-wide features.

The final test league finished 21–61 and restored the identical result and awards after refresh with visible restoration progress. Verified league leader search, eight-player opponent rosters, cross-team comparison, game filtering, both-team box scores and award finalists. No document overflow at 1440, 390 or 320 pixels; no warning/error entries in the checked browser session. Final screenshots: `docs/design/league-awards-desktop.png` and `docs/design/league-awards-mobile.png`.

## Scope and verification limits

- No injuries, aging, contracts, free agency, CPU-initiated trades, generations after II, accounts, multiplayer or public hosting.
- The clock uses 7.5-second ticks and one-minute substitution decisions. The simulation is statistical, not a spatial or fully officiated real-league simulator. Depleted rosters retain only enough disqualified players to remain five-on-five; subsequent fouls add a technical free throw.
- A previous browser security decision denied a PNG download test. No retry or workaround was made. Downloaded PNG output remains unverified.
- Standalone Playwright CLI tests were not executed in this desktop session; browser checks used the supported in-app browser. An environment with authorized automation can run `npm run test:e2e`.

## Continue

1. Pull `main` with `git pull --ff-only origin main` before editing; preserve uncommitted work in either environment.
2. Node ≥24.15, tested 24.19.0. Run `npm ci` after dependency changes. Local bundled Node is `/Users/sam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`.
3. Preview: `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`. Cloud may need `--host 0.0.0.0` and its forwarded URL.
4. Run appropriate checks, commit and push before switching environments. Reconcile concurrent work without force-pushing.
5. **Preserve regular-season models 3/4, postseason model 1 and franchise model 1 before changing deterministic inputs or outputs.** Roster draft, schedule, event probabilities, profiles, aggregation and award formulas all affect replay validation. Future behavioral changes need new model versions and migration.

Browser saves stay in their browser. Shared links carry eight player IDs, not coaching or results. See [league formulas](LEAGUE_MODEL.md), [design QA](../design-qa.md), [screenshots](design/), [README](../README.md), and the [implementation plan](superpowers/plans/2026-10-15-league-simulation.md).
