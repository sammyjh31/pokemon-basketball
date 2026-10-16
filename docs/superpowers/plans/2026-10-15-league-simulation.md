# League Simulation Implementation Plan

Goal: A reproducible30-team basketball league with unique Gen1/2 rosters, richer symmetric matches, league statistics and awards.
Architecture: shared types first; independent match-engine, presentation and data domains; parent integrates league scheduling, aggregation, migrations and async state. Freeze old models before modifying shared behavior.
Tech stack: existing React/TypeScript/Vite/Vitest; no new packages.
Spec: ../specs/2026-10-15-league-simulation.md

## Constraints and review focus
- 30teams ×8unique species;82games each;41home/41away;1230unique games; original151 facts unchanged.
- Every point/minute/make/assist/steal/block must reconcile across both teams and standings; 240minutes +25/OT per side.
- Player identity includes team; all league awards use global eligible production and deterministic tie-breaks.
- Preserve completed model1/2 saves; new output model3; saved state below3MiB.
- No replay drift, stale simulation application, duplicate records, result spoilers, or roster edits while simulating.

## Tasks
- [x] Freeze v2 simulator/ratings/opponents/boxscore/validator; extend types; add failing league contract/conservation tests.
- [x] Match domain: new profile.ts and match.ts, own tests; symmetric event engine and actual lineups; signature simulateMatch(home:LeagueTeam,away:LeagueTeam,seed:number):LeagueMatch.
- [x] Data domain: import Gen2 facts/local assets preserving Gen1 facts; update scripts/manifests/provenance; pool tests and old151 assumptions.
- [x] League domain: league.ts exports createLeague(run):LeagueTeam[], leagueSchedule(seed):LeagueFixture[], simulateSeason and simulateSeasonAsync progress; aggregate1230matches, award eligibility and standings; deterministic compact persistence.
- [x] UI domain: LeaguePanel/LeagueBoxScore, league.css; integrate SeasonPanel league overview/awards/rosters/leaders/comparison, old model displays preserved.
- [x] Integration: defensive scheme control and scouting profiles; async simulation progress/locking; save migrations; playbook/docs; tests/build/browser/independent review.
- [x] Commit and push clean verified main.

## Review decisions and verification ledger

- Baseline: `9f8118c`; user explicitly requested local work and continued commits/pushes to the shared main branch. Reused this checkout for its active preview.
- Existing league contract first failed expecting model3 from the old model2 engine. Added schedule, uniqueness, conservation, global honors, replay and save-size coverage; those pass.
- Full integration suite passed119tests and production build before the final review fixes. Three legacy tests now legitimately run several full1,230-game replays; their individual timeout budgets were raised from5s to20s after timing-only failures reproduced and assertion checks passed.
- Independent review verified frozen v2 logic/data, shared-result arithmetic and compact saves. Async hydration now renders before replay validation, with progress and abort handling. A shared-lineup import over a damaged save explicitly enables persistence. Both findings have regression coverage and passed focused independent re-review; no findings remain.
- Fixed play-type labeling to reflect actions including second chances and foul continuations.
- Ruling: AI draft now evaluates each player's best vacant starter role instead of fixed PG-first rounds. Three-seed franchise-player role suitability regression failed before and passed after. This retains seeded snake order and no duplicate species.
- Added new-model strong/weak player calibration alongside frozen v2 regression checks. Current core balance, shared-league and role-balance tests pass (8tests).
- Mobile awards use one column below600px after inspection at320px; tables stay contained and horizontally scrollable.
- Final verification: 127 tests across 21 files, TypeScript/production build and diff whitespace checks passed. Browser test season 21–61 survived refresh with identical awards; user origin's earlier 69–13 remained intact. Checked all league views, modal details, progress, no browser warnings/errors, and responsive widths 1440/390/320. Evidence and verification limits are in `design-qa.md` and `docs/LOCAL_HANDOFF.md`.
