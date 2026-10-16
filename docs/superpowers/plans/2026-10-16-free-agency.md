# Free Agency Implementation Plan

> **For agentic workers:** Use test-driven development; dispatch the isolated UI task in parallel with the engine/persistence work, then request a fresh review of the combined changes.

**Goal:** Sign released Pokémon in franchise offseasons, including fair deterministic CPU activity, without changing roster sizes or losing history.
**Architecture:** A pure freeAgency engine and optional typed transaction ledger; a separate market component; reducer, next-season lifecycle and existing chronological save validator integrate the feature.
**Tech Stack:** React, TypeScript, Vitest, existing bundled data; no dependencies.
**Spec:** docs/superpowers/specs/2026-10-16-free-agency-design.md

## Constraints and review focus

- Exactly 30 rosters of eight unique active species. Only released species can enter the market.
- Preserve development offsets across releases, signings and later seasons; no artificial career appearances.
- Signings follow a completed draft and replay in order with package trades.
- CPU round is idempotent, does not change the user's roster, protects current rookies and records zero-move rounds.
- Existing saves without freeAgency still restore. Corrupt event chronology must not silently repair a save.

## Tasks

- [x] Engine: add freeAgencyTypes.ts and freeAgency.ts, with tests for pool eligibility, legal/invalid replacements, roster uniqueness, training/minutes/development preservation, CPU choices and repeat-run guards. API: freeAgentMarket, freeAgencyReady, evaluateFreeAgentSigning, signFreeAgent, processCpuFreeAgency.
- [x] UI: FreeAgentMarket.tsx/CSS/tests; searchable/sortable market with scouting, replacement preview, signing action, CPU button and year-filtered activity. Wire optional onSignFreeAgent and onCpuFreeAgency props through FranchisePanel; parent wires App.
- [x] Persistence/lifecycle: add optional Franchise.freeAgency, preserve it on archival, replay interleaved signings in franchiseTransactions.ts, parse strict fields in freeAgencyValidation.ts, verify save round trips/tampering and next-season auto CPU activity. Reducer actions SIGN_FREE_AGENT and PROCESS_CPU_FREE_AGENCY.
- [x] Review and verification: run full suite/build, inspect browser flow with an isolated save, and merge against current main without overwriting other work.

Delivery follows verification: commit the isolated feature, fast-forward main while preserving unrelated working files, push and verify the remote SHA.

## Verification notes

- Meaningful red tests preceded the engine and save/lifecycle implementations.
- Independent review found no high/medium issues; independent market/panel checks passed 29 tests.
- The initial complete run passed 510 tests; its sole failure was the existing app assertion that CPU rosters could not change before the next year. The assertion now checks the finalized league and unchanged user roster; all five app tests passed on rerun.
- Browser QA used an isolated test franchise: completed a generation-IV draft, signed Graveler while releasing Groudon, observed 13 CPU signings including Groudon, reloaded, signed Wailord after the CPU round, and started/reloaded Year 3. Both signed players were retained. No browser errors; 390px mobile layout had no horizontal overflow.
- Isolated and combined type-matchup builds passed. The combined run passed 545 of 546 tests; its sole failure was the 30-second limit on a batch of eight complete malformed-save replays. Each corruption is now an independent case; the entire 11-test save/lifecycle group passed with the combined engine. This covers all 554 current tests across the full regression run and focused rerun. No production changes followed that regression run.
- Integration preserved the separately developed type-matchup/coaching changes. Only the free-agency feature files are included in this commit.
