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
- [ ] 2. Merge PR #6 onto the integrated result, resolve court and lifecycle conflicts, then verify game-flow and old-save tests.
- [ ] 3. Run the full suite and end-to-end tests, fix confirmed failures, obtain a fresh review, and merge/push both PRs in dependency order.

## Progress and decisions

- Baseline: origin/main d8ad223; reused isolated matchup-engine worktree on codex/claude-pr-integration. Primary checkout and Claude worktrees contain other work and remain untouched.
- The user's request authorizes completing the handoff, including merging and pushing the remaining PRs. No new feature design is included.

- Task 1 verified: 29/29 balance tests, original CPU legacy offseason and next-season hashes (1/1 selected regression), typecheck and build passed. Red run reproduced the historical capsule mismatch; pinning the generator's original court-v2 inputs and next-year output restored BOTH original hashes without changing expected fingerprints. Current-season adoption remains covered separately.
- Merge resolution: retained mastery reports and accepted development report models 1/2; retained both CPU front-office and court-balance documentation.
