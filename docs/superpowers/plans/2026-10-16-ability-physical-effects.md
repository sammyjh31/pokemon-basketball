# Physical ability effects implementation

1. Capture current-release replay; add failing tests for bounded shared physical effects and statistics.
2. Implement pure effect API and apply it to simulation movement, screen coverage/contact, rebound weights and fatigue/recovery. Test actual outcomes and diagnostics.
3. In parallel domains after the API contract: thread version through new games, persistence, archives and season boundaries; integrate playable-game physics; integrate shared coaching/evaluation/training and visible descriptions/statistics.
4. Verify legacy hashes, new deterministic matches, lifecycle and official-game validation, complete franchise save/restore, and UI/build. Review changes independently and repair findings.
5. Document mechanics and compatibility, commit coherent changes, push HEAD to main, verify remote SHA.

## Verification and review

- Main final mechanics/regression sweep: 23 files, 128 tests passed (40.17 seconds), including all arcade tests, bounded shared effects, direct court geometry/rebound behavior, full-versus-compact simulation, disabled parity, evaluation, official result validation, old/current replay fingerprints and stats UI.
- Production TypeScript/Vite build passed; existing >500kB bundle advisory remains (main bundle 1,474.48kB / gzip 335.21kB).
- Isolated desktop/mobile browser check: eight player rows, document widths equal 1440px/390px viewports, zero page errors. Screenshots saved under docs/design; temporary harness removed without reading or changing user saves.
- Independent review found one important screen-direction error under hedge/trap; corrected with a failing-then-passing distance regression for both coverages. No unresolved actionable findings. Long-run competitive balance was outside the review because no balance target was specified; all physical profiles are bounded and determinism is verified.
- Lifecycle validation exposed a physical-stat serialization-order mismatch and missing summary-only career reconciliation; both were repaired and covered by regression assertions.
- Final end-to-end and integration sweep on the reviewed patch: 8 files, 44 tests passed (79.27 seconds). Includes the complete 82-game season, playoffs, offseason, career/physical totals, JSON restoration, valid and corrupted summary-only archives, next-season launch, market/coaching decisions, local-rival compatibility and playable official-game UI.
