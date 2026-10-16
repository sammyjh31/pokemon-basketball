# Offseason Overhaul Implementation Plan

> **For agentic workers:** Use the dispatching-parallel-agents and test-driven-development skills for independent domains; parent integrates and reviews boundaries.

**Goal:** Deliver multi-player trading, coach-aware market suggestions, offseason management and two-round generational rookie drafts.
**Architecture:** Pure trade/draft engines with shared typed interfaces; dedicated UI panels; reducer and save validation own atomic lifecycle changes. Preserve legacy simulations and primary-checkout work.
**Tech Stack:** Existing React/TypeScript/Vite/Vitest; factual PokeAPI CSV import, no new runtime dependencies.
**Spec:** docs/superpowers/specs/2026-10-16-offseason-overhaul-design.md

## Global Constraints
- 30 clubs, eight unique players per club; packages 1/2/3 each side.
- Two rookie rounds, 60 replacements, weakest record first; Gen III onward.
- Preserve original 251 facts and initial league/draft pool; old careers survive release.
- Keep completed run and historical inputs immutable; reject stale ownership.

## Review Focus
- Suggestions must still pass the exact execution evaluator.
- Trading and draft picks must conserve 240 active unique species and development ownership.
- Partial drafts and package transactions must restore with full chronology checks.
- Offseason lineup changes must not alter old results.
- Late-generation exhaustion must not trap the franchise or fabricate rookies.

## Tasks
- [x] Trade engine: tests, package exchange, strategy/availability, evaluation, bounded suggestions and CPU negotiation. New tradeTypes.ts/tradeMarket.ts; extend rosterTrades.ts without changing legacy helpers.
- [x] Trade UI: tests and TradeCenter.tsx; searchable market, package builder, explanations, accepted suggestions, trade history rendering. Parent wires FranchisePanel.
- [x] Draft/data: preserve base pool, bundle later facts/assets, rookieDraftTypes.ts/rookieDraft.ts/RookieDraftPanel.tsx and tests. Parent handles saved-franchise schema, reducer and validation.
- [x] Parent: offseason roster editor and state actions; atomic package application; variable career membership, draft/trade chronology and corrupted-save tests; wire lifecycle/UI.
- [x] Defensive leaderboards, career views, per-36 rates and offensive/defensive rebound splits in box scores.
- [x] Full tests/build, independent review, browser QA and documentation.
- [ ] Scoped commit, coordinated primary integration/push and remote verification.

## Verification

- Full feature suite: 461 tests across 73 files passed. Production build passed.
- Combined snapshot with the concurrent local-league work: production build and 34 targeted tests passed, including legacy replay, local league, rookie catalog, saved offseason chronology and shared statistics views.
- Browser: completed a two-player package trade, edited offseason positions/coaching, restored a partial draft after reload, completed both rookie rounds and simulated Year 2. Verified league/playoff/career defense statistics, released careers and mobile table scrolling without page overflow.
- Independent review repaired an optional-rotation save-validation bug and mismatched trade-suggestion package sizes; regression coverage passed.
