# Verified Franchise Loading Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans. Use TDD for each task, then one independent whole-branch review.

**Goal:** Reopen long franchises without replaying already-verified years while preserving identical results and all retained history.

**Architecture:** A signed, revision-bound browser cache supplies archive verification and active replay evidence to the existing validators. Source saves remain authoritative; ordinary replay handles every miss.

**Tech Stack:** Existing TypeScript/Vite/React, WebCrypto HMAC/SHA-256, IndexedDB, Vitest and Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-18-verified-franchise-loading-design.md`

## Global constraints

- No simulation rules, source save formats, engine flags, or history retention changes.
- Cache database separate from source/backup/quarantine; failure means ordinary replay.
- HMAC binds namespace, revision, input digest, payload; key non-extractable and atomic across workers.
- Individual payload limit 8 MiB; approximate total cache limit 32 MiB; two active snapshots per format.
- Publish only after successful whole-load validation; preserve cancellation and worker boundaries.

## Review focus

- Altered career/trade/coach state must still fail despite an unchanged certified historical year (task 2/3).
- Cache records copied between inputs, namespaces or engine revisions must miss (task 1).
- Concurrent first workers must share the same persisted key; late aborted work must not overwrite a newer save (tasks 1/4).
- New season and offseason changes must reuse unchanged years without trusting new history (tasks 2/3).
- Missing/quota/blocked/corrupt cache must preserve source saves and recovery behavior (tasks 1/4).

## Task 1: Signed storage and automatic revision

Files: new `src/game/replayCache.ts`, `src/game/replayCacheStorage.ts`, `scripts/replay-cache-revision.ts`, their tests, revision ambient types; modify `vite.config.ts`.

Interface: `ReplayCache.get<T>(scope, input): Promise<T | undefined>` and `put(scope, input, value): Promise<void>`; injected record store and Crypto allow real integrity tests. Browser factory opens only the separate cache database. Virtual revision module contains a source digest and participates in relevant dev updates.

- [ ] Write failing tests for durable real-HMAC reopening, invalid records/input/revision, unavailable store, size limits, and production-source revision changes.
- [ ] Observe failures; implement authenticated best-effort storage, bounded metadata eviction, atomic key creation and source fingerprint plugin.
- [ ] Run focused tests/typecheck, then commit/push.

## Task 2: Incremental solo franchise restoration

Files: `persistence.ts`, `franchiseValidation.ts`, `restore.worker.ts`, `restoreClient.ts`, new cached-restoration tests.

Interfaces: optional `ReplayCache` on deferred preparation; internal certified-year set supplied only by authenticated cache lookups. Existing `VerifiedArchives` replay material remains supported. Worker/page fallback create optional browser cache. Cache keys bind complete raw years/includeLegends and exact raw runs.

- [ ] Write a real multi-year cold/warm regression: identical complete loaded output, zero warm replay work, unchanged years reused after active progression/offseason edits, corrupted global careers/history rejected, active/history independent.
- [ ] Observe expected replay-count failure; add proof lookup, count only misses, retain all cross-history validation, and publish after success.
- [ ] Run solo replay/persistence/worker regressions and exact-output audit; commit/push.

## Task 3: Local careers and current-season evidence

Files: `localCareer.ts`, `localLeague.ts`, `localLeagueRestore.worker.ts`, `restore.worker.ts`, new local-cache coordinator/tests.

Interface: optional local replay context maps years to compact replay evidence and captures misses. Async worker coordinator authenticates evidence before calling the existing synchronous parser and publishes only after successful parse. Current-season simulation uses exact-draft signed snapshots.

- [ ] Write failing multi-year real local-career cold/warm parity/progress tests, altered history/coach/trade rejection, and next-year cache reuse.
- [ ] Implement evidence extraction/reuse without bypassing roster, development, draft, trade or coach chronology; keep old parser calls unchanged by default.
- [ ] Run local parsing/career/mastery/morale/chemistry/worker tests; commit/push.

## Task 4: Warm loading UX, browser proof and measurements

Files: `App.tsx`, restoration/UI tests, `tests/e2e/saveRecovery.spec.ts` or a focused cache spec, `scripts/performance-audit.mjs`, performance/handoff docs.

- [ ] Add failing warm-progress and real browser persistence/refresh/cache corruption/cancellation cases; render opening wording for zero replay games.
- [ ] Add cold/warm benchmark support using the real cache and unchanged save; compare complete hashes and progress, record measured results without extrapolating browser timing.
- [ ] Verify UI/build and focused browser checks; commit/push.

## Task 5: Complete verification and GitHub handoff

- [ ] Run full regressions and desktop/mobile browser checks on stable production code; resolve findings with regressions.
- [ ] Request one independent whole-branch review; address actionable findings.
- [ ] Record exact results and limitations, push final commits, create/attach PR and update GitHub using the existing authorized workflow. Keep the active preview worktree and primary dirty checkout intact.

## Execution ledger

- Baseline: `d26f3c2`; previous task verified the identical production tree with 1,328 tests, 44 browser checks, build and complete-output fingerprints. Existing dependency symlink retained. Reuse the managed preview worktree; no new checkout/dependency installation.
- Ruling: proceed inline under the user's explicit implementation and GitHub authorization; the persistence design is documented for review without adding approval round trips for routine implementation choices.
