# Claude PR Integration Plan

> Execute inline using superpowers:executing-plans; finish with a fresh review.

**Goal:** Integrate PRs #2 and #6 with current main, preserving old saves and the mastery/news features, then publish the verified results.

**Architecture:** Keep historical engine branches intact. Merge each PR into a branch descended from current main; retain both sides of additive features and resolve genuinely shared algorithms explicitly.

**Tech stack:** TypeScript, React, Vitest, Playwright, Vite.

**Spec:** Existing PR #2 balance design/docs and PR #6 game-flow/play-depth specs; user handoff of 2026-10-17.

## Constraints and review focus

- Preserve original CPU legacy and release fingerprints; fixture generators must explicitly reconstruct their historical rules rather than changing expected hashes without evidence.
- New seasons adopt current rules while active seasons retain saved rules.
- Preserve mastery, morale, chemistry and news snapshots across save/replay/archive paths.
- Preserve court v3 balance alongside game flow, including garbage time and possession behavior.
- Run CPU-heavy verification sequentially; do not stop unrelated user processes.

## Tasks

- [x] 1. Merge PR #2, reproduce the CPU legacy mismatch, confirm its exact source, resolve it, and verify balance/replay/typecheck/build.
- [x] 2. Merge PR #6 onto the integrated result, resolve court and lifecycle conflicts, then verify game-flow and old-save tests.
- [ ] 3. Run the full suite and end-to-end tests, fix confirmed failures, obtain a fresh review, and merge/push both PRs in dependency order.

## Progress and decisions

- Baseline: origin/main d8ad223; reused isolated matchup-engine worktree on codex/claude-pr-integration. Primary checkout and Claude worktrees contain other work and remain untouched.
- The user's request authorizes completing the handoff, including merging and pushing the remaining PRs. No new feature design is included.

- Task 1 verified: 29/29 balance tests, original CPU legacy offseason and next-season hashes (1/1 selected regression), typecheck and build passed. Red run reproduced the historical capsule mismatch; pinning the generator's original court-v2 inputs and next-year output restored BOTH original hashes without changing expected fingerprints. Current-season adoption remains covered separately.
- Merge resolution: retained mastery reports and accepted development report models 1/2; retained both CPU front-office and court-balance documentation.

- Task 2 verified: 55/55 tests across 13 game-flow, play-depth, mastery and historical replay files; typecheck and build passed. Original game-flow release fingerprint restored by reconstructing its actual court-v2, pre-mastery rules. No recorded hashes changed.
- Merge resolution: retained BOTH mastery and flow fixture snapshots across regular season, playoffs, archives and box-score replay; retained independent adoption arguments in local-career validation. Court-v3 rebound/garbage-time rules coexist with game flow. Play-depth tests now exercise court versions 2 and 3.
- Integration method: merge current main into each PR's history rather than rewriting Claude branches; final branch updates can fast-forward and preserve all original commits.

- Final review (fresh read-only reviewer, d8ad223..f3d30b6): three important findings confirmed—disabled weather setters, local v3 playoff qualification/coach-record validation, and timeout substitutions losing garbage-time policy. First full-suite run stopped to fix these before final verification; archive tests completed so far passed. No full-suite success claimed.
- Deferred minor: hot-player targeting after run/rest timeouts remains late-timeout-only; existing hot/cold play selection still works. This is a limited coaching-policy follow-up.
- Review scope decisions: prior statistical audit tables describe their recorded v2/v3 runs, not a newly measured combined-engine benchmark (combined balance remains a calibration follow-up); runtime UI and final test/build status will be verified by the executor.

- Review fixes: weather candidates now honor each team's abilities setting; timeout and minute-window substitutions share the same garbage-time predicate; court-v3 local archives allow cutoff ties structurally then validate champion and coach seeds against replayed games. Added integrationRules.test.ts: disabled setters, actual late-game reserve participation, strict replayed coach seed validation and a real coached local save/reload. All four have passed after reproducing failures; existing local-career/court/game-flow group passed 36 other cases (the initial discovery fixture changed when garbage time was corrected, so the final tiebreak fixture explicitly freezes game flow off).
- Broad preflight found stale test inputs: DevelopmentRatings marked an incomplete duplicate roster as complete; OfficialArcade's fabricated final state omitted current mastery metadata; evaluationLocalMarket's hand-built rookie comparison omitted roster morale effects. Fixtures now represent valid partial rosters, current arcade mastery setup, and the actual public rookie transaction respectively. Production validation is retained.
