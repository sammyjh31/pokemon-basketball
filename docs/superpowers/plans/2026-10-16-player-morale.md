# Player morale implementation plan

1. Freeze pre-morale seeded replay; implement pure state/update/validation/transaction helpers with tests for actual minutes, success, coach fit, bounded effects, reset/retention, and no mutation.
2. Wire frozen morale into match profiles and active-five chemistry; wire previews/transactions through shared helpers.
3. Independently wire lifecycle and provenance: defaults, season/playoffs/played games, rookie/free agency, archives and save restoration. Independent arcade work uses the same immutable snapshots and effective profile modifier.
4. Independently add coach policy/evaluation/training and visible current and historical morale reports. Preserve rotation minute budgets and base ratings.
5. Test modern seeded simulated and played outcomes, carryover, transactions, save tamper rejection and historical compatibility. Review complete diff, inspect real UI with isolated fixtures, typecheck/build. Commit and push to main, verify remote SHA.

Use separate ownership for lifecycle, coach/UI, arcade, and core/match/market files. No editing primary checkout or user save data. Existing worktree remains the local preview.

## Verification completed

- Core, match, coach policy, chronology, official games, league lifecycle, market transactions, arcade and morale UI: 34 focused tests passed across 11 files.
- Pre-morale and earlier seeded replay hashes, abilities and chemistry regression: 18 tests passed across nine files.
- Full 30-team, 1,230-game season and playoffs, second franchise year, in-progress save restoration and archived game replay passed.
- Additional owner verification covered modern two-season local careers with trades/rookies, current and archive tamper rejection, historical compatibility, automatic training, weighted lineup reports and playable-game entry.
- Independent review found two arcade integration gaps (missing fixture version/snapshot, stale exhibition banks); both fixed and reviewed with component tests.
- Native Chrome isolated previews at 1440×1000 and 390×844: current and historical factors inspected, no horizontal overflow or page errors; user storage untouched.
- Typecheck and production build passed. Vite retains the existing large-chunk advisory. Local preview on port 5173 responds successfully.
