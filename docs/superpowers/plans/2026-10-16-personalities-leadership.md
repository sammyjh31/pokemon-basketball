# Personalities and Leadership Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for owned tasks. Independent lifecycle, UI/coaching and arcade domains can proceed concurrently with the fixed contract below.

**Goal:** Give Pokémon distinct reactions and automatically appointed captains who influence morale and actual-five teamwork.
**Architecture:** Deterministic species profiles and captain selection derive from frozen team inputs. A version flag preserves historical replay; existing morale banks/snapshots retain their encoding.
**Tech Stack:** TypeScript, React, Vite, Vitest.
**Spec:** docs/superpowers/specs/2026-10-16-personalities-leadership.md

## Global Constraints
- personalityVersion1 requires moraleVersion1; preserve every flag-absent result.
- No new RNG draws, dependencies, manual captain controls or extra roster slots.
- Morale target leadership influence capped±3; actual-five captain cohesion capped±2; existing skill caps/minute budgets unchanged.
- Work only in the existing pokemon-matchup-engine worktree; preserve primary checkout, user storage and node_modules symlink.

## Review Focus
- Mixed/removed flags must reject saves and played-game submissions.
- Trades involving captains must derive new appointments from current species, not old slots.
- Bench captain supports team morale but supplies no on-court chemistry bonus.
- Pending playoff and away official fixtures must use frozen snapshots and preserve captain orientation.
- Legacy franchises adopt only at season boundaries; prior archives must retain original captain-free replay.

## Tasks
- [x] Freeze the e8681b9 morale replay hash. Write failing personality/reaction/captain tests, implement playerPersonality.ts and versioned playerMorale integration. Add comparative behavior tests and capped active-five effect in lineupChemistry/matchChemistry/match.
- [x] Lifecycle owner adds flag to types/defaults/league/season/archive/official/local/validation boundaries and independent morale chronology. Extend official fixtures and multi-year save tests, including invalid dependencies and mixed generations of engine rules.
- [x] Coach/UI owner adds leadership to shared projected lineup context, personality-aware support/training and current/history/draft-visible explanation. Cover automatic captains, reports, weighted lineup aggregation and all UI arcade setup flags with meaningful tests.
- [x] Arcade owner adds setup/state version, leadership context and strict dependency validation, preserving absent-version replay. Test substitutions, frozen pregame identity and serialized deterministic behavior.
- [x] Run focused modern/legacy tests, typecheck/build, browser desktop/mobile checks and independent code review. Resolve findings and document results.
- Release: commit to the working branch, push HEAD to origin/main, and verify the remote SHA.

## Verification evidence

- Core personality, reactions and actual-game integration: 8 tests passed, including all 1,025 species, role/transaction responses, captain replacement and stability, active-five-only effects, and frozen full/compact match parity.
- Existing morale/ability/chemistry/physical/shared-evaluation replay and transaction coverage: 24 tests passed; the pre-personality e8681b9 match hash remains `6d8594defd3eba4abea8fa084e5ef0d4495e687eeca5b68593ccea433146c2ff`.
- Lifecycle/official/chronology, local two-year rookie/trade saves, and earlier engine-boundary tests: 24 passed. Official captain reports apply frozen chemistry before morale. Active legacy seasons adopt only at a recorded next-season boundary.
- Arcade: all 103 tests passed, including old replay hashes, authoritative setup flags, serialization and captain substitutions.
- Full franchise integration: 1,230 games, playoffs, offseason retention, second-season progress/save restore and archived-game replay passed in 228.83 seconds.
- Desktop 1440px and mobile 390px browser checks: current roster, historical report and scouting display personalities and captains; zero page errors or horizontal overflow. Isolated Chrome contexts retained zero localStorage entries; real saves untouched.
- Production build and TypeScript passed. Vite retains the existing large-chunk advisory.
- Independent core/lifecycle review found no remaining actionable issues.
- UI/coaching/evaluation coverage: 84 distinct tests passed across scoped runs. The two full-season UI restore/invalid-prefix cases passed in 280.08 seconds together. Only their integration wait budgets were increased to accommodate full 1,230-game replays; all assertions remain intact.
