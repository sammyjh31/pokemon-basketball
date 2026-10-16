# Expanded local league and explainable probability model

The user requested five additional generations for the next draft, deeper statistics to understand what matters, and a first refinement covering basketball realism and Pokémon identity.

Keep old drafts and completed seasons on their existing catalog and engine. New local leagues use Generations I–VII and model 2. Solo challenge/franchise retains the original pool and engine. Do not overwrite any current local league in the user's browser.

- [x] Preserve the first 251 factual inputs, append species through Gen VII, bundle portraits/sprites and attribution, retain the legacy catalog export for solo modes.
- [x] Version local drafts and fixed-roster engine inputs; old version-1 saves must keep the same CPU picks and season/playoff replay hash.
- [x] Add a bounded probability model with smoother shot odds and explicit matchup, spacing, fatigue, role-fit and species-size effects. Use the exact same function in a matchup explorer. Do not claim it is calibrated to real NBA data.
- [x] Add team analysis and advanced game statistics with clearly labeled estimates and safe zero denominators. Explain what the metrics measure and avoid causal claims from correlations.
- [x] Test old replay, expanded eligibility, probability sensitivity/bounds, real match conservation, analytics arithmetic, save restore, desktop/mobile usability, and the full existing suite/build.

Apply the existing TDD and verification workflow inline. Catalog/assets and analytics were delegated under the parallel-work skill, but both agents encountered temporary model capacity; continue inline when unavailable. Preserve all prior uncommitted local league work. No deployment or network multiplayer in this scope.

## Verification

- Full suite: 423 tests across 71 files passed.
- Browser workflows: all 12 desktop/mobile checks passed, including newer-generation picks, matchup controls, analytics, playoffs, refresh restoration and preservation of solo progress.
- Production build and `git diff --check` passed. Vite retains its large-chunk advisory.
- Independent review found no remaining actionable defects and swept 4,854 bounded shot scenarios. A later full-suite check caught the solo shared-lineup catalog boundary; repaired and covered solo placement and roster validation before the final passing run.
- Inspected desktop/mobile analysis, draft and explorer screenshots; corrected portrait sizing and verified no horizontal overflow or overlapping probability output.
- Old version-1 draft, full season and playoffs retain the pinned replay hash. No user browser save was advanced or replaced.

The user authorized coordination with the separate franchise-overhaul chat. After this verification, integration ownership passes to that chat; preserve this work unstaged and rerun combined feature checks when merging its wider franchise catalog and validation changes.

The coordinated franchise/controller integration subsequently passed all 493 tests across 82 files, the production build, and the full local draft/season/playoff browser flow with separate franchise progress preserved. The local-league commit uses those verified combined source bytes while leaving later type-matchup work unstaged.
