# Shared Team Evaluation Implementation Plan

> For agentic workers: implement the pure contract first, then use dispatching-parallel-agents for the independent market and lifecycle/draft domains. Parent owns policy, simulation and UI integration; one fresh whole-change review follows.

**Goal:** Consistent, visible player/team valuation across coaches, trades, drafting, free agency, rotations and training.
**Architecture:** Pure versioned evaluator; consumer-specific eligibility/strategic constraints remain outside it. Historical policies remain gated.
**Tech Stack:** TypeScript, React, Vitest, Vite.
**Spec:** `docs/superpowers/specs/2026-10-16-shared-team-evaluation.md`

## Global Constraints

Work only in the existing pokemon-matchup-engine worktree, leave node_modules symlink unstaged, no user browser-save changes. Preserve prior seeded replays. No rating formula changes. Bounded and deterministic ability credit. User has authorized commits and push to main. Separate worker file ownership and no worker commits. Test with one Vitest worker. Run focused integration/replay tests rather than unrelated full-suite repetition.

## Review Focus

1. Historical data: old/current flagged saves, mixed flags, season transitions and transaction replay; test frozen hashes and restore paths.
2. Context drift: changed coach, offsets, roster and disabled abilities; test fresh evaluations and explanation factors.
3. Cross-system inconsistency: duplicated modern scheme/talent weights, bypassed CPU/local paths, actual substitutions; test consumer choices and direct shared deltas.
4. Constraints: eight unique players, equal trade packages, rookies protected, legal rotation totals and development caps; existing domain tests plus new integration cases.
5. Performance: nested candidate evaluations and repeated possession decisions, no factorial assignments or stale identity caches; time representative draft/market/simulation tests.

### Task 1: Shared evaluator and frozen replay baseline

Files: new `teamEvaluation.ts`, `teamEvaluation.test.ts`, `evaluationReplay.test.ts`.
Interfaces: `EvaluationTeam`, `createEvaluationContext(team, excludeIds?)`, `evaluatePlayer(context,id,role?,offsets?)`, `evaluateTeam(team)`, `compareTeamEvaluation(before,after)`, `evaluationGamePlan(team)`, `evaluationTrainingOptions(team,id,role?)`, `abilityUsefulness(id,profile)`.
Player factors carry label/value/contribution; comparison factors carry label/change/contribution/detail; result score/delta and reasons. Roster roles use slots, bench uses strongest role; raw talent stays separately accessible.
Write deterministic, changed-context, ability toggle, replacement, training and boundedness tests first; run to see missing-module failures, then implement and pass. Capture a prior-release coached draft+match hash before any behavior changes. Expected: new tests pass and old hash stays exact.

### Task 2: Market integration (independent worker)

Files: tradeMarket, freeAgency, rookieDraft, rosterTrades and focused tests. Modern branches use shared roster deltas and factors in acceptance/ranking and suggestions; preserve legacy policy, fairness, club direction and rival context. Expected: focused existing/new transaction and rookie tests pass.

### Task 3: Version lifecycle and initial/local draft integration (independent worker)

Files: types, draft, league, persistence, franchiseValidation, franchise, archive, localLeague, localCareer, draftAdvice, LocalLeagueDraft and focused lifecycle/draft tests. Carry evaluationVersion through every path and transaction replay. Assign CPU coaches before new initial drafting. Wire local human advice and local offseason transactions. Expected: modern/legacy roundtrips, adoption and local/solo recruiting tests pass; frozen baseline unchanged.

### Task 4: Coach, rotation, training, simulation and explanation integration

Files: coachPolicy, coachTraining, coachOffice, match, matchLineups, CoachSummary and focused tests. A separate worker owns arcade setup/types/coaching, its CPU-substitution gate and ArcadeMode input plumbing; share valuation without changing arcade physics or controls. Preserve legacy outputs; share ability helper exactly; new plans, targets, substitution role values and training use evaluator. Include evaluation version in target cache; reject mixed match rules. Add visible score/factor explanations in coach summary. Expected: policy consistency, workload/minutes, modern CPU matches and historical hashes pass.

### Task 5: Validate, review, commit and push

Run focused domain/lifecycle tests and real franchise save restore, production build. Inspect UI without touching user save. Fresh most-capable reviewer checks full diff against Review Focus. Fix actionable findings with regressions. Update LOCAL_HANDOFF; commit coherent verified chunks and push HEAD:main after verifying remote ancestry. Expected: origin/main equals local HEAD, only existing node_modules symlink untracked.

## Final verification and decisions

Completed in `c1e3b8c` (pure model) and `a855ad4` (consumers/lifecycle/UI), followed by the final documentation and historical-fixture commit. Production build passed; existing large-bundle advisory remains. Root policy/simulation/UI suite: 70 tests across 14 files. Markets: 49 tests across 6 files. Arcade/UI: 57 tests across 10 files. Lifecycle/draft/history: 24 tests across 6 files, plus local draft UI 10 and local league 7. A real modern 82-game season, playoffs, camp, CPU trades, archive/save/restore and next-season launch passed in 64.65 s. Frozen legacy hashes remain exact. Isolated desktop/mobile browser inspection found 8 rows, no document overflow and no page errors. No user save was changed.

Fresh independent review of both implementation commits found no Critical, Important or Minor issue. Reviewer independently passed 14 core/coaching/replay tests and the full modern draft/FA/trade-search integration. The historical rival fixture update was separately verified against untouched e741795: its three failures predated this work. Omitting the newer ability/evaluation flags from that explicit original-rules fixture restored its unchanged assertions.

Decisions retained after review:

- Local modern trade replay validates legality and recorded consent but does not re-negotiate with a later hire. The save format lacks hire/trade interleaving; requiring today's approval would invalidate legitimate saves. Edited local save files can bypass this fairness check, as recorded user transactions already can.
- Trade suggestions screen a bounded set with shared player values and then compare full rosters. This keeps three-player suggestions around 0.83 s in the implementation benchmark but can omit acceptable combinations. Package assignment checks at most six permutations, not a whole-roster factorial search.
- Recruiting projects offseason appointments while transactions preserve historical coach metadata. Incoming-player permutation choice depends on role fit; all coach-sensitive aggregate components are permutation-invariant. Universal positional ratings choose the same best role as shared valuation because its other terms are independent of role.
- Training uses headroom-adjusted estimates of marginal shared value, not promised skill gains. Actual development retains its existing random outcomes, workload, risk and caps. A changed roster need can change a focus's value without displacing a clearly better focus.
- Within-game snapshots remain valid; simulated role values refresh when the active scheme changes, and every new game gets fresh developed profiles/context. Arcade keeps its distinct physics and human controls while sharing CPU rotation values.

No deferred review findings. Earlier overly broad archive and free-agency persistence runs were stopped without results; they are not counted as passing. Focused lifecycle coverage and the completed full modern franchise restore provide the relevant evidence.
