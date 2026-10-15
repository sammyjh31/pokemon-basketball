# Pokémon Basketball Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable five-starter Pokémon basketball drafting game with two draft modes, position ratings, and an 82-game season.

**Architecture:** A React browser app uses independent pure modules for ratings, drafting, and seeded simulation. A reducer owns run transitions; validated, versioned localStorage persists the run and records. Pokémon statistics ship with the app, while portrait failures fall back gracefully.

**Tech Stack:** React, TypeScript, Vite, npm, Vitest, React Testing Library, and Playwright; Node 24.

**Spec:** `docs/superpowers/specs/2026-10-15-pokemon-basketball-design.md` (approved October 15, 2026).

## Global Constraints

- A roster consisting of five starters only: PG, SG, SF, PF, and C.
- An 82-game regular season; the original 151 Pokémon; two drafting modes; browser-local saving; desktop and mobile support.
- Two re-rolls are available for the entire five-pick run.
- Each offer contains four distinct, randomly selected Pokémon from the eligible undrafted pool.
- Construct a fixed 82-game schedule across 29 fictional Pokémon-themed opponents, with 41 home games and 41 away games.
- One completed season is allowed per drafted roster.
- Use the available Node 24 runtime and npm with a committed lockfile.
- Use the existing isolated checkout; do not create a worktree unless requested.
- Keep work in `/workspace/pokemon-basketball`. No account system, backend, public deployment, copied reference application code, or unverified readiness claims.

## Review Focus

- Storage disabled or quota exceeded: play continues in memory with a visible persistence notice (Task 4).
- A partially corrupted save containing valid JSON: reject inconsistent rosters, offers, counters, and results without crashing (Task 4).
- Starting a new run while results are revealing: old timers never alter the new run (Task 5).
- Portrait requests failing or a narrow mobile viewport: every Pokémon and court action remains identifiable and usable (Task 5).
- Clipboard permission denied: a selectable text recap replaces the success announcement (Task 5).

## File Structure

- Project configuration: `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `.gitignore`.
- Data: `scripts/import-pokemon.py`, `src/data/pokemon.json`, `src/data/pokemon.ts`, `src/data/opponents.ts`, `src/data/SOURCES.md`.
- Rules: `src/game/types.ts`, `random.ts`, `ratings.ts`, `draft.ts`, `season.ts`, `state.ts`, `persistence.ts`; colocated `*.test.ts` files.
- App: `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/hooks/useGame.ts`.
- UI: `src/components/{Court,DraftPanel,PokemonCard,Scoreboard,SeasonPanel,RulesPanel,ConfirmDialog,Portrait}.tsx` and `src/components/App.test.tsx`.
- Browser checks: `playwright.config.ts`, `tests/e2e/game.spec.ts`, `src/test/setup.ts`.
- Handoff: `README.md`; environment installation/start instructions saved through the cloud configuration tool.

## Shared Data Contracts

Define these names in `src/game/types.ts`; consumers import them rather than duplicating shapes.

- `Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'`; export `POSITIONS` in that order.
- `Mode = 'spin' | 'free'`; `Roster = Record<Position, number | null>`.
- `Pokemon`: `id`, `name`, `types: string[]`, `stats: { hp, attack, defense, specialAttack, specialDefense, speed }`, `heightM`, `weightKg`, `legendary: boolean`, `spriteUrl`.
- `Attributes`: `shooting`, `playmaking`, `finishing`, `perimeterDefense`, `interiorDefense`, `rebounding` (all finite numbers from 0 to 100).
- `TeamRatings`: `offense`, `defense`, `overall`, `filled`, `complete`.
- `Opponent`: `id`, `name`, `offense`, `defense`, `pace`, `style`.
- `Matchup`: `index`, `opponentId`, `home`.
- `GameResult`: `index`, `opponentId`, `home`, `winProbability`, `teamScore`, `opponentScore`, `won`, `overtime`, `playerOfGameId`.
- `SeasonResult`: `games: GameResult[]`, `wins`, `losses`, `mvpId`.
- `Run`: `id`, `mode`, `includeLegends`, `roster`, `offerIds: number[]`, `rerollsLeft`, `draftSeed`, `seasonSeed`, `result: SeasonResult | null`.
- `Records`: `spin` and `free` each contain `runs`, `bestWins`, `perfectSeasons`.
- `GameState`: `version: 1`, `run: Run`, `records: Records`.

Keep pending UI selections and reveal progress out of saved game rules. Store the full completed season atomically before revealing results.

### Task 1: Pokémon Data and Basketball Ratings

**Files:** Project configuration; data importer, Pokémon data, sources; `types.ts`, `ratings.ts`, `ratings.test.ts`.

**Interfaces:** Produces `POKEMON: Pokemon[]`, `POKEMON_BY_ID: Map<number, Pokemon>`, `attributes(mon: Pokemon): Attributes`, `positionRating(mon: Pokemon, position: Position): number`, `teamRatings(roster: Roster): TeamRatings`, and exported formula constants used later by the rules UI.

- [ ] **Step 1: Prepare the executable test harness.** Create the npm/Vite/TypeScript configuration with scripts `dev`, `build`, `typecheck`, `test`, and `test:e2e`. Install compatible current stable packages, record their exact resolution in `package-lock.json`, and ignore `node_modules`, `dist`, and browser test artifacts. Tests use Vitest; `npm test -- --run` must terminate with a real test result.
- [ ] **Step 2: Write failing data and ratings tests.** Assert `POKEMON.length === 151`, unique IDs 1–151, valid six-stat records, positive height/weight, and exactly five flagged legendary/mythical Pokémon (144, 145, 146, 150, 151). Assert every attribute and role rating is finite and within `[0, 100]`, `positionRating(Alakazam, 'PG') > positionRating(Alakazam, 'C')`, and `positionRating(Snorlax, 'C') > positionRating(Snorlax, 'PG')`. Synthetic inputs with tenfold height/weight above the caps must produce identical capped size features. Assert empty and partial rosters are incomplete and a full roster is complete.
- [ ] **Step 3: Run `npm test -- --run src/game/ratings.test.ts`.** Expect failure from the missing data/ratings implementation, not a broken test runner.
- [ ] **Step 4: Implement the data importer and rating functions.** Use verified HTTPS downloads of PokeAPI's public CSV files from `raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/`: `pokemon.csv`, `pokemon_stats.csv`, `pokemon_types.csv`, `types.csv`, and `pokemon_species.csv`. Join IDs 1–151, convert decimeters/hectograms to meters/kilograms, and commit the resulting JSON with source URLs and retrieval date. Read legendary/mythical flags from species data. Importing is a development operation, never a runtime requirement. Portrait URLs use the PokeAPI sprites repository on `raw.githubusercontent.com`.

Use `base(s) = clamp(100 * s / 160, 0, 100)`, `height = clamp(100 * log1p(m) / log(4), 0, 100)`, and `weight = clamp(100 * log1p(kg) / log(251), 0, 100)`. Keep full precision until rendering. Weighted attribute definitions:

| Attribute | Weights |
| --- | --- |
| Shooting | .60 specialAttack + .25 specialDefense + .15 speed |
| Playmaking | .45 specialAttack + .40 speed + .15 specialDefense |
| Finishing | .50 attack + .30 speed + .20 height |
| Perimeter defense | .45 speed + .30 defense + .25 specialDefense |
| Interior defense | .45 defense + .25 hp + .15 height + .15 weight |
| Rebounding | .25 hp + .25 defense + .30 height + .20 weight |

Position weights, in attribute order `[shooting, playmaking, finishing, perimeterDefense, interiorDefense, rebounding]`: PG `[.20,.45,.10,.20,0,.05]`; SG `[.45,.15,.20,.15,0,.05]`; SF `[.25,.15,.25,.15,.10,.10]`; PF `[.10,.05,.30,.05,.20,.30]`; C `[.05,.05,.20,.05,.35,.30]`. Compute player offense as `.35 shooting + .30 playmaking + .35 finishing`, defense as `.40 perimeterDefense + .35 interiorDefense + .25 rebounding`; blend each with position fit at `.75 attribute score + .25 role rating`. Average across filled positions; empty-team values are zero. Overall is the mean of offense and defense. Show the filled count separately.

- [ ] **Step 5: Re-run the ratings tests and `npm run typecheck`.** Require all data and role assertions to pass; inspect the actual Alakazam/Snorlax values if a test reveals an unsuitable weighting rather than weakening the assertion.
- [ ] **Step 6: Commit the validated data/rating module and its tests.** Message: `feat: add Pokemon data and basketball ratings`.

### Task 2: Deterministic Drafting

**Files:** `src/game/random.ts`, `draft.ts`, `draft.test.ts`.

**Interfaces:** Consumes Pokémon IDs and `Roster` from Task 1. Produces `nextRandom(seed: number): { value: number; seed: number }`, `createRun(mode: Mode, includeLegends: boolean, seed: number): Run`, `reroll(run: Run): Run`, `placePokemon(run: Run, pokemonId: number, position: Position): Run`, and `swapPositions(run: Run, first: Position, second: Position): Run`. Invalid actions return the unchanged run.

- [ ] **Step 1: Write failing draft tests.** For seeds 0–199, assert a new spin run offers four distinct eligible Pokémon and starts with exactly two re-rolls. Assert re-rolling twice gives zero remaining, a third is unchanged, placing an offered Pokémon locks that position, a chosen Pokémon never appears in a later offer, and a non-offered ID cannot be placed. Assert free-draft replacement and occupied-slot swapping preserve uniqueness; invalid IDs, duplicate placement, spin swaps, and any edit to a completed run are rejected. Assert excluding legends removes IDs 144–146 and 150–151. Equal initial seeds and action sequences must yield equal runs.
- [ ] **Step 2: Run `npm test -- --run src/game/draft.test.ts`.** Expect failures for missing draft functions.
- [ ] **Step 3: Implement the draft functions.** Use a pure 32-bit Mulberry32 step and Fisher–Yates sampling. Seed draft and season streams independently from the initial unsigned seed using distinct fixed salts. Derive a stable run ID from the initial seed; a new UI run obtains its seed from `crypto.getRandomValues`. Generate the next offer immediately after placement until all five slots are filled, then clear offers. Free mode never generates offers. Failed actions never consume random state. Distinct rerolls may overlap earlier offers, but each current offer stays unique.
- [ ] **Step 4: Re-run draft and rating tests.** Require deterministic equality and all rule invariants across the sampled seeds.
- [ ] **Step 5: Commit.** Message: `feat: implement spin and free draft rules`.

### Task 3: Season Simulation

**Files:** `src/data/opponents.ts`, `src/game/season.ts`, `season.test.ts`.

**Interfaces:** Consumes Task 1 ratings and Task 2 random stepping. Produces `OPPONENTS: Opponent[]`, `SCHEDULE: Matchup[]`, `winProbability(team: TeamRatings, opponent: Opponent, home: boolean): number`, and `simulateSeason(run: Run): SeasonResult`. Reject incomplete or completed runs with a descriptive error; the reducer additionally guards these calls.

- [ ] **Step 1: Write failing season tests.** Assert 29 unique opponents, 82 scheduled games, and 41 home/away games. For complete seed-fixed rosters assert deep-equal repeat simulations; exactly 82 finite integer score pairs; no tied final scores; `won === (teamScore > opponentScore)`; `wins + losses === 82`; and every player-of-game/MVP ID belongs to the roster. Assert improving offense or defense never reduces win probability and probabilities remain strictly inside `(0, 1)`. Assert incomplete/completed runs are rejected. Across 500 seeds, a stronger synthetic team must have a higher average win total. Directly test a tied regulation-score helper to ensure overtime preserves the intended winner.
- [ ] **Step 2: Run `npm test -- --run src/game/season.test.ts`.** Expect missing simulation failures.
- [ ] **Step 3: Implement schedule and results.** Define 29 fictional Pokémon-place team names, ratings ranging from 35 to 65, and pace offsets from -6 to 6. Schedule two full opponent cycles plus the first 24 opponents; alternate home/away by game index. Use `difference = ((team.offense - opponent.defense) + (team.defense - opponent.offense)) / 2 + (home ? 1.75 : -1.75)` and `p = clamp(1 / (1 + exp(-difference / 9)), .01, .999)`.

Sample the winner first. Draw integer regulation scores from matchup means centered around 104 plus pace and `.4 * offense-minus-defense`, with bounded independent scoring noise. Assign the larger score to the sampled winner; ties go to overtime with positive extra points and a winning margin. Keep score generation in a pure `resolveScore(teamRegulation: number, opponentRegulation: number, won: boolean, seed: number)` helper returning scores, overtime flag, and next seed. Choose each player of the game with weights `max(1, positionRating)^2`; MVP wins the most awards, breaking equal counts by higher position rating and then lower Pokémon ID. Separate UI reveal timing from this synchronous deterministic computation.

- [ ] **Step 4: Run all engine tests.** Inspect representative weak, balanced, and strong rosters' season records and score ranges. If numerical behavior is implausible, diagnose and adjust documented model constants together with the rules panel source; never change a seed merely to present an undefeated run.
- [ ] **Step 5: Commit.** Message: `feat: simulate seeded 82-game basketball seasons`.

### Task 4: Run State and Safe Persistence

**Files:** `src/game/state.ts`, `state.test.ts`, `persistence.ts`, `persistence.test.ts`.

**Interfaces:** Consumes Tasks 1–3. Produces `initialState(seed: number): GameState`, `gameReducer(state: GameState, action: GameAction): GameState`, `loadGame(storage: StorageLike, fallbackSeed: number): { state: GameState; notice: string | null }`, and `saveGame(storage: StorageLike, state: GameState): { saved: boolean; notice: string | null }`. `StorageLike` exposes `getItem(key): string | null` and `setItem(key, value): void`. Use key `pokemon-basketball:v1`.

`GameAction` is a tagged union: `REROLL`, `PLACE { pokemonId, position }`, `SWAP { first, second }`, `SIMULATE`, and `NEW_RUN { mode, includeLegends, seed }`. Confirmation occurs before dispatching `NEW_RUN`; the reducer owns all game legality checks.

- [ ] **Step 1: Write failing state tests.** Simulating a partial run is unchanged; simulating a full run records precisely one result and increments the correct mode's history once; repeated simulation is unchanged; edits after completion are unchanged; a new run clears results while preserving history. Reloading a saved completed run must not increment history again.
- [ ] **Step 2: Write failing persistence tests.** Round-trip a draft and a completed season. Reject malformed JSON, unsupported versions, unknown IDs, duplicate roster IDs, negative counters, invalid seeds, duplicate/taken offers, and a result with 81 games or inconsistent totals/scores. A throwing `getItem` or quota-error `setItem` must return a usable fallback/result and notice without throwing.
- [ ] **Step 3: Run `npm test -- --run src/game/state.test.ts src/game/persistence.test.ts`.** Expect missing implementation failures.
- [ ] **Step 4: Implement reducer and structural validation.** Validate unknown parsed values before using them. Check IDs, exact positions, unsigned seeds, legal counters, four eligible offers for incomplete spin runs, empty offers for complete/free runs, and result identities/order against the fixed schedule. Validate integer records and relationships such as `perfectSeasons <= runs`. Derive and compare win/loss and MVP totals. Build a fresh validated object rather than trusting arbitrary saved fields. Retain a meaningful notice when restoration falls back. Store results and history together in one state write.
- [ ] **Step 5: Run all engine/state tests and TypeScript.** Require completed-season locking, single history increments, and both storage-error cases to pass.
- [ ] **Step 6: Commit.** Message: `feat: persist drafts and completed season records safely`.

### Task 5: Playable Court UI, Browser Validation, and Handoff

**Files:** App, hook, components, CSS, component/e2e tests, Playwright config, README; environment draft fields.

**Interfaces:** Consumes the reducer, persistent state, Pokémon records, shared formula constants, and schedule. `useGame()` returns `{ state, dispatch, storageNotice }`. Components receive their required state and callbacks through typed props; they do not modify engine objects. `Portrait` owns image-failure display. `ConfirmDialog` owns focus return and destructive-reset confirmation. `SeasonPanel` owns reveal progress only.

- [ ] **Step 1: Write failing component tests with deterministic initial-state injection.** Exercise five legal spin picks, re-roll counter/selection clearing, disabled simulation before pick five, simulated results locking the roster, free-draft search/type filter/replacement/swap, and confirmation cancellation preserving the current run. With fake timers, start result reveal, reset, advance old timers, and assert the new run remains empty. Mock reduced motion and verify immediate results. Mock portrait `error` and clipboard rejection and assert readable fallbacks. Verify storage failure is announced without disabling draft controls.
- [ ] **Step 2: Run `npm test -- --run src/components/App.test.tsx`.** Expect missing UI failures while all existing engine tests remain intact.
- [ ] **Step 3: Implement the desktop and mobile game.** Use navy `#101b2d`, cream `#f5f1e9`, orange `#ef7b35`, and a hardwood CSS half-court. Place PG near the top of the key, SG/SF on wings, and PF/C near the basket, with position labels and portraits. Show draft progress and offense/defense/overall values; label incomplete ratings provisional. Place draft choices beside the court on desktop and beneath it on mobile. Announce pending selection and placements; use actual buttons for every court slot and option.

Implement the two mode controls, legendary toggle, search/type filter, role-fit preview, remaining re-rolls, result reveal/skip, season table, MVP, separate historical records, new run, and recap copying. Display projected win probabilities only for complete rosters. Use a small view state for pending selections; clear it after placement, mode changes, and rerolls. In free mode, select an occupied slot then another to swap, or select a candidate then a slot to replace. Completed runs expose viewing/recap/reset actions only. Show the formulas from the rating constants in an expandable rules panel. Keep attribution and unofficial fan-project notice in the footer.

Persist reducer state through `useGame` with guarded browser storage. Result reveal uses an effect scoped to the run ID with timer cleanup; the complete season is already computed and saved. A restored completed season shows all results immediately. Reduced motion skips reveals. A clipboard error reveals selectable recap text and never announces a successful copy. Use an accessible dialog with focus containment, Escape/cancel, and focus restoration for resets with any placed players. Use visible focus, labels, live-region announcements, and type names alongside colors.

- [ ] **Step 4: Run component tests and repair any real interaction failures.** Require all assertions, including timer cancellation and storage/clipboard/portrait failures, to pass.
- [ ] **Step 5: Write and run `tests/e2e/game.spec.ts`.** Through the real UI, complete one Spin & Pick season and one Free Draft season; verify 82 results and a record totaling 82, refresh preservation, a full keyboard-only draft, and reset confirmation behavior. Run at desktop 1440×1000 and mobile 390×844; assert no document overflow, inspect screenshots of the draft and completed season, and check console errors. Configure Playwright to start/reuse the Vite server on port 5173 and retain failure traces. Install a Chromium browser through supported verified downloads; if external access is blocked, diagnose and save the precise domain requirement without bypassing verification.
- [ ] **Step 6: Verify the complete workflow.** Run `npm test -- --run`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`. Start `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort` in the repository and verify an HTTP response plus the browser interaction above. Check `git diff --check` and repository status. Distinguish passing, failing, and blocked checks. No public preview URL is required or supported by the onboarding UI.
- [ ] **Step 7: Document and save tested setup.** README includes installation, development, testing, data sources, drafting rules, and implementation limitations. Read the current cloud draft, preserve its unrelated settings, and save `install_script` with the tested repository working directory and `npm ci`; include browser installation only if required and verified. Save `start_skill` with existing-checkout guidance, dependency checks, the tested dev-server command, and HTTP/browser readiness checks. Retained files are separate from processes that must restart. Verify `npm ci` preserves the lockfile, rerun checks affected by installation, and report draft persistence separately from publication.
- [ ] **Step 8: Commit and hand off.** Message: `feat: deliver playable Pokemon basketball draft and season UI`. Use the selected execution skill's review process, resolve material findings, rerun affected checks, and report the running workflow and any limitations with evidence.

## Plan Self-Review

- Approved spec sections map to Tasks 1 (data/ratings), 2 (draft rules), 3 (schedule/simulation), 4 (state/persistence), and 5 (complete player flow, accessibility, validation, and environment handoff).
- All consumers use the shared contracts and exact function names above; no external live API is required for game rules.
- Each Review Focus condition has a specific test in the task that owns it.
- Product code, dependency installation, and implementation execution begin after the user reviews this plan and selects an execution approach.

## Execution Recommendation

Use native execution in this session: one implementer completes the five tasks in order, followed by a fresh whole-branch review. The tasks share a small set of types and build on each other, so sequential implementation avoids coordination overhead. Subagent-driven execution remains an alternative if the user prefers a separate implementer/reviewer cycle for each task.
