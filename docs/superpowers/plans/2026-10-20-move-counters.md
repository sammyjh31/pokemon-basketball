# Move counters implementation plan

> For agentic workers: use superpowers:executing-plans inline. One independent final review.

**Goal:** Automatic, evidence-driven move counters and counter-combos across all simulated games.
**Architecture:** Versioned shared court runtime; existing scouting carries compact observations; optional move telemetry uses current aggregation and validation.
**Tech Stack:** TypeScript, React, Vitest, Playwright. No new dependencies.
**Spec:** ../specs/2026-10-20-move-counters.md

## Global constraints
- Preserve omitted/v1/v2 results and historical rules. New rules use movesetVersion 3.
- Never learn future actions; every fixture uses its own pregame scouting snapshot.
- Actual energy, cooldown, mastery, active-lineup and chemistry constraints apply to both teams.
- All modes share simulateMatch; arcade games do not gain invented simulated counters.
- Commits, pushes, merge and Pages publishing are authorized by the existing user instructions.

## Review focus
- Old saved seasons, mixed-version franchise history and warm/cold restoration retain identical results.
- CPU games, partial advances, playoffs and historical boxes all use the same reads.
- Counters cannot use benched/fouled-out/tired players or leaked scouting references.
- Disabled abilities/adaptive coaching produce no new counter effects or observations.
- Counts, energy and court event totals reconcile; bounded effects and one response prevent loops.

## Tasks
- [x] 1. Pin a v2 full-match fingerprint; write failing unit tests for observed-only learning, bounded counters, energy/cooldowns, paired readiness and offensive counter-combos. Implement counterTypes.ts and moveCounters.ts.
- [x] 2. Write failing integration tests for real full/compact matches, completed-game scouting, snapshots, all-fixture propagation and telemetry validation. Introduce v3 adoption, integrate court/match/scouting and telemetry, preserve older fingerprints. Commit/push.
- [ ] 3. Write failing UI checks; expose automatic reads and counter usage in move/box views. Verify lifecycle, cold/warm saves, regular/playoff/CPU games, legacy rules and desktop/mobile flows. One independent branch review, resolve findings, typecheck/build, document evidence, commit/push, merge and verify Pages.

## Execution ledger
- Baseline c983d67; existing managed worktree reused. Primary checkout untouched.
- Ruling: use moveset v3 rather than a second feature flag, keeping signature/combo v2 explicitly frozen and reusing all existing move-version propagation/validation.

- Core evidence: 59 checks in eight files pass (11.68 s), including frozen v2 match SHA 7fe4e0361617b96cb95abbed7a5ff52485648d2d3ecc3d8dae84312b2e480088 and prior moves-v1 coverage. Adoption/new-feature group 15 checks passed (14.54 s). Typecheck passed. New full-league and local cold/warm lifecycle group running.
- Ruling: record offensive observations directly in compact match output, rather than infer them from total move uses; a move used defensively must not be mistaken for an offensive pattern. Official arcade boxes cannot invent these observations.
- Ruling: historical v1/v2 local fixture explicitly pins its second season to v2; default adoption assertions advance to v3. No released fingerprint is updated.
