# Implementation plan

1. Define compact tactical/scouting contracts and test pure assignment, screen and help decisions against controlled real player profiles. Implement deterministic decisions with bounded basketball/type weighting.
2. Independently implement opponent scouting accumulation and validation with tests for chronological observations, isolation, decay and mutation safety. This module can be delegated under the parallel-agents skill after the contract exists; it owns only its module and tests.
3. Integrate tactical decisions into simulateMatch behind typeTacticsVersion. Preserve old RNG/arithmetic paths. Add complete-game tests, diagnostic reports and exact pregame context.
4. Propagate opt-in version through new runs, leagues, franchise/local persistence and archives. Add mixed/malformed/legacy save tests.
5. Wire sequential scouting through standard and local season builders, playoff progression/replay, and all match-detail/insight resolvers. Verify stepped/async/replay equivalence and official-result precedence.
6. Display learning and tactical counters in game reports and explain rules. Run focused then complete regression suites and build. Request independent review focused on persistence, context orientation, temporal leakage, fairness, bounded effects and performance. Integrate only changed files after checking concurrent edits.

Execution: root owns integration and tactics; one independent module may run in parallel. Current uncommitted project changes are the baseline, not part of this patch. Preserve them and use a native isolated worktree. Do not commit unrelated work.

Implemented and integrated into the shared project. Independent review corrections cover event-rate units, actual switch coverage in both shot models, and pruning playoff continuation memory. Historical rule flags and every production detail-replay call retain the correct pregame context.

Verification: the full 678-test regression run identified two timeout limits, an older seed-only replay test, and stale modules from changes made during the run. All affected tests were corrected/retested: 97 checks passed in the broad rerun before the final stress test, both save stress tests then passed, and the final shared-workspace suite passed 88 tests across nine tactical, persistence, replay and UI files. The shared production build and diff whitespace check passed. Existing bundle-size warning remains. Concurrent local draft UI edits were preserved.
