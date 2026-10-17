# Species abilities implementation

1. Add pinned ability data and a tested, shared conditional-effect API with bounded basketball adaptations and activation counters.
2. Plumb versioned rules through solo/local seasons, playoffs, archives and validation. Integrate effects and counters into the shared simulation.
3. Independently integrate the shared API into playable arcade games and official box conversion; build scouting and statistics UI after contracts exist.
4. Make coach game plans, rotations and training ability-aware, with explanations and targeted tests.
5. Verify persistence/replay compatibility, aggregation, UI and build. Run a fresh review, address findings, commit and push to main.

Validation results and deviations will be recorded here as work completes. Existing historical seasons remain on their original rules; future solo franchise seasons adopt version 1. Avoid the expensive full suite when focused integration checks cover the changed paths.

## Completion record

- Added pinned canonical first-normal-slot data: 1,025 species / 224 names, with 21 explicit basketball mechanics; all original ratings/catalog files remain unchanged.
- Red → green: shared API and conditional effect tests; simulation defaults/counters/aggregation; arcade release effects and official validation; coach behavioral changes and training explanations; UI rendering.
- Versioned new modes and solo/local future seasons. Ruling: use per-season local team flags during restore, keeping the original draft flag frozen — old multi-season saves must not be implicitly upgraded by validation.
- Ruling: activation counts describe an actual probability adjustment, not a successful basket. Simulator counts foul attempts and unblocked shots; arcade counts release because its probability is sampled before blocks. Official counts remain unscaled.
- Core API/simulation initial run: 7 tests passed; expanded simulation outcome/probability check: 4 tests passed. Same scores in one seed were a valid outcome, so the outcome test checks six fixed seeds while separately asserting changed probabilities.
- Lifecycle/local career/engine depth/exact legacy replay run: 32 tests passed. Expanded ability lifecycle and full coach-franchise save/restore: 7 tests passed (57.30 s). An initial lifecycle assertion was corrected from JSON byte ordering to structural equality across normalization; the archived rules/results remain equal.
- Arcade/official regression run: 60 tests across 9 files passed. Review added shot-cap and strict official-version checks, both red → green.
- Coaching: 13 tests passed. UI: 62 tests across 9 affected suites; final mobile-order/official-fixture rerun: 30 tests passed.
- Fresh independent whole-feature review: no actionable findings; 18 shared/arcade tests independently passed. Production build and typecheck passed. Existing bundle size advisory is non-blocking.
- Isolated SSR/browser previews checked at desktop and 390px. TOTAL is visible before horizontally scrollable detail; no document overflow. Screenshots in docs/design/species-abilities-{desktop,mobile}.png. No user save or browser storage modified.
