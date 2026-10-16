# Rival roster learning implementation plan

**Goal:** Teams recruit and trade to counter learned rivals across seasons.
**Architecture:** Compact annual rival evidence feeds a pure roster strategy evaluator. Existing draft/trade flows consume bounded scores; archived inputs preserve prior behavior.
**Spec:** docs/superpowers/specs/2026-10-16-rival-rosters.md

## Constraints and review focus

Preserve concurrent source edits and old saves; no broad commits. Use existing seeded games and authoritative played results. No future evidence, no benefit from departed opponents, no unbounded bonuses, no bypass of talent/rotation floors, no duplicate ownership or unauthorized human picks. Keep candidate searches bounded and caches local to immutable snapshots.

## Tasks

- [x] Annual evidence: rivalScoutingTypes.ts, rivalScouting.ts and tests. Export captureRivalScouting(league, playoffs) and parseRivalScouting(value, rosters). Compact top-three rivals/threats; include final playoff encounter; immutable and strict validation.
- [x] Pure strategy: rivalRosterStrategy.ts and tests. Export createRivalStrategy(team, teams, history, year); active/rivals/playerValue/score/change/explanation. Recency over three completed years, current-roster filtering, sample confidence, best-two coverage and bounded change.
- [x] Standard integration: franchise archive/validation, rookieDraft.ts, tradeMarket.ts and types; full before/after factors for both clubs, informed shortlists and current-roster final negotiations. Explain recommendations in RookieDraftPanel and TradeCenter.
- [x] Local integration: localCareer.ts and local offseason UI; archive/parse/replay reports, rookie ranks and CPU trade acceptance; preserve friend approval and old chronology. Independent agent may own these files after shared interfaces are defined.
- [x] Verification: focused failing tests before implementation, deterministic multi-year/save/replay tests, relevant existing draft/trade/local/franchise suites, production build, independent review, full regression run once source is stable, then integrate only task changes and archive worktree.

Execution: root owns strategy and standard integration. Parallel-agents skill permits delegation of independent annual-evidence and local integration modules with explicit file ownership. Baseline is /tmp/pokebb-rivals-baseline, not Git HEAD.

Verification completed:

- Focused tests established failing behavior before implementation and passed after integration.
- Full regression run: 758 tests passed; the remaining refresh/restore UI test hit its existing 5-second outer timeout despite a 10-second inner wait. Its outer allowance now covers the simulation and replay (15 seconds); the unchanged assertions passed on a focused rerun in 5.60 seconds. All 759 tests have passed across the full run and this rerun.
- Production build and TypeScript passed. The existing bundle-size warning remains.
- Independent review found no actionable correctness issues. A possible live-context cache optimization for CPU trade search is nonblocking; a real 30-team report took approximately 0.76 seconds in the reviewer’s measurement.
- Integration uses the task manifest and compares each shared file against its baseline before copying. Concurrent local draft/scouting UI work is preserved.
