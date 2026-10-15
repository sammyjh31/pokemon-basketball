# Eight-player simulation implementation plan

> For agentic workers: use the plan task-by-task; independent files may be assigned through dispatching-parallel-agents. Parent integrates and verifies.

Goal: An eight-player basketball game with coherent individual box scores, team awards and meaningful scouting/rotation decisions.
Architecture: Expand shared types first; isolate ratings/scouting, simulation, roster persistence, and results presentation. Keep deterministic pure game modules and React state/reducer conventions.
Tech stack: existing React/TypeScript/Vite/Vitest; no new dependencies.
Spec: ../specs/2026-10-15-eight-player-simulation.md

## Global constraints

- Exactly five starters plus three reserves; no duplicates across all eight slots.
- Original151; two challenge rerolls;82 games,41home/41away.
- Per-game player points equal team score; shooting totals are coherent;240minutes +25 per OT.
- Team-only awards; no invented league/career comparisons.
- Keep prior saves/records recoverable; five-player links still load.
- Commit and push validated code to main, no force push.

## Review focus

Partial/duplicate/legend-ineligible bench; zero-attempt percentage display; tampered saved box scores; refresh after old save migration; narrow-screen stat-table overflow. Add tests with the owning implementation.

## Tasks

- [x] Shared contract and roster: types.ts; draft/state/lineup/persistence; App/Court/DraftPanel/BenchPanel. Eight slots; auto-fill; coaching; safe v1 migration. Tests: all8unique;8needed;bench swap;old5link;invalidbench rejection;completedv1retainsrecord.
- [x] Ratings/scouting: ratings.ts, ratings.test.ts, ScoutReport.tsx, RulesPanel.tsx, scouting.css. Finite0–100; bounded size/type effects; distinct roles; stamina/mass/role tradeoffs; bench/tactics affect team. Expose breakdowns and honest model explanation.
- [x] Simulation: season.ts plus focused boxscore/award modules. Tests first for score/minute/make conservation, seeded repeatability, opponent/mode effects, overtime and statistical aggregation; implement shot/turnover/rebound/assist/defense events; derive results and awards.
- [x] Results UI: SeasonPanel/SeasonStats/BoxScore/results.css. All8player stats sortable and pergame/totals; six team awards; accessible game detail; archivedv1notice. No result spoilers before reveal completes.
- [x] Integration: update tests and e2e expectations; unit/build checks; in-app browser free+challenge+season+refresh+mobile; independent review; updated guide/README/handoff; commit/push.
