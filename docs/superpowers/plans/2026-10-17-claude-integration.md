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

- Broad preflight: 183/193 files passed (967 tests), 10 files failed on stale fixtures. Corrected old rule flags instead of changing hashes; synthetic roster replacements now rebuild matching mastery state. Current official-game fixtures include their setup's mastery metadata. Coach-history tests cover both truly pre-mastery optional training records and mandatory current mastery provenance, using postseason banks for training expectations.
- Persistence runtime root cause reproduced: original first persistence round-trip exceeded its 120,000 ms deadline, completing in 175.89 seconds with no competing suite. It generated the same fixed season twice and verified it twice. Cache only the generated test fixture and clone it per case; production replays and all assertions still execute.
- Performance sample: 60 matched pairs on court v3, no insights: 37.38 ms/game without flow, 39.53 ms/game with flow (+5.7%). This is a focused runtime sample, not a new statistical balance audit. Full replay defaults now allow 300s; multi-year explicit restore cases allow 600s. Full-season UI waits allow 120s, matching browser season waits.
- Final full suite uses one invocation, bounded to four workers on this 10-core / 32 GiB host; no competing test suites. The repository's default maxWorkers remains 1. This avoids the handoff's multiple independent full-suite overload while bounding resource use.

- Full-suite save investigation: a genuine summary-history bug rejected a real Magikarp season with 64 appearances (19,662 league appearances versus the old assumed 19,680). Reproduced through direct production validation, then fixed unknown summary-year appearance bounds; detailed archive years still require exact replay totals. Unknown playoff years also allow individual reserves to have DNPs. Current-year validation remains exact.
- The deferred archive-corruption test now changes a valid frozen tactic. Changing the season seed is correctly rejected earlier because saved news fixture IDs encode that seed; it no longer exercises deferred replay.
- Free-agency corruption cases now use the production post-worker validator with an independently simulated verified archive map, avoiding eight repeated identical archive replays. Real full-load valid ledger/CPU/year-two cases remain, plus a dedicated corrupt-ledger full-load test that checks preserved original bytes.
- Remaining explicit free-agency and rival-history replay deadlines now match measured multi-season work. Added actual Game context checks and screenshots to the desktop/mobile season E2E flow.

- Free-agency year-two assertion now checks the intended invariant (user roster/development/mastery unchanged by CPU signings), while permitting the existing season-boundary morale and chemistry retention rules. Both pre-mastery and current local coach-career save tests passed.

- The complete 234-file run is collecting remaining failures. Additional stale assertions compare CPU deals by raw rating despite evaluationVersion 1, omit next-season mastery adoption, and expect offseason morale/bond banks to remain byte-identical. Updated tests retain the intended fairness/roster/development/mastery invariants, using the shared-value model and retention rules. No production trading or season-boundary behavior changed.
- Remaining UI replay deadlines were embedded in App/FranchiseApp/FranchiseGamesApp: multi-replay tests now allow 300–600s and whole-archive UI waits 120s. A timeout inside a fake-timer React act can leave later cases blank, so those complete files will be rerun after the full invocation finishes.

- Legacy model-4 development fixture accidentally adopted growth/morale/personality flags at its generated season boundary, so forcing it to model 2 correctly failed. It now removes all earned-history flags/banks and asserts the intended summary-only model before authoring its historical report.
- Summary-only appearance corruption tests now use an impossible >82-per-season count; a one-game decrement for an unknown reserve year cannot be distinguished from a valid DNP. Detailed archive appearance checks remain exact.
- League tests now bound appearances and exact starts instead of requiring every reserve to play all 82 games. Late-season opponent replay includes all frozen context snapshots. The measured one-season output is 4,214,254 bytes; its regression budget is now 5 MiB, with actual large-save storage and long-career budgets separately verified.

- Complete suite finished: 234 files, 1,271 passed tests, 26 failed tests, 3 skipped, 2,571.28 seconds. One of the skipped tests is the pre-existing largest-local-career stress case; two were blocked by a 30s setup-hook timeout in offseasonMarketPersistence.
- Full-run failures are test fixtures/oracles, short deadlines, or UI readiness/save-effect timing. Simulation/replay production code remained unchanged during the full run and the correction pass. Corrected fixture-specific shared-value, retention, DNP, historical flags, and frozen-context expectations instead of weakening production validation or changing golden hashes.
- Additional exact-archive regression now rejects a plausible one-game career appearance edit when detailed archive rows exist. The same edit cannot be disproved for unknown summary-only reserve seasons; their tests use impossible >82-per-season counts instead.
- Physical-ability franchise coverage now checks both pre-earned-history and current saves. Summary-only physical totals are supported for historical saves; modern mastery saves must retain their game provenance. Chemistry/playoff comparison fixtures now replay mastery and flow snapshots.
- Offseason package/rookie corruption matrices use genuine independently simulated verified archives at the production post-worker boundary, with valid full loads and representative corrupt full loads retained. Setup and multi-replay deadlines reflect actual work.
- Focused correction run maps every reported failure and hook-blocked test by its test title, plus affected adjacent cases and the new archive guard. Vitest 5 filters do not accept the JSON reporter's suite-joined names as literal test names, so the first diagnostic selection was corrected before using it as verification. Current progress: 32 passed, zero failed; two package/rookie full-persistence tests remain running. Browser verification and publication still pending.

- Correction verification complete: 34/34 selected cases passed across 17 files. The coverage audit maps all 26 failed cases plus two setup-blocked cases to passing runs, including the extra historical/current physical case: 1,300 covered tests passed and one pre-existing largest-local-career stress case remains intentionally skipped. Build/typecheck pass; browser verification and publication remain.

- Browser verification complete: initial 44-case run finished (34 passed, 10 failures in localCareer/saveRecovery test setup). Corrected normal-restore deadlines and seeded returning-player preferences, including new tabs and storage clears. Both complete files passed in fresh contexts: 18/18, covering every original failure. Browser audit confirms 44/44 desktop/mobile cases covered and passed. No application code changed during browser verification. Ready to publish PR heads and merge in dependency order.
