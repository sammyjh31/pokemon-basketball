# Season and franchise performance

The performance pass preserves seeded outcomes and save formats. A frozen court-v4 regression checks the SHA-256 of the complete 1,230-game season, including boxes, league leaders, awards, scouting, morale, mastery and shared court history. Historical replay regressions continue to cover earlier rules.

Physical ability modifiers reuse immutable values for the same conditional effect and exact mastery multiplier. Each effect keeps at most 256 continuous-mastery variants. In-game chemistry identifies player groups with a match-local bitset and invalidates the cache when its inputs change. Recipient-indexed synergy bonuses retain the existing candidate order and strongest-source rules.

An offseason save contains the just-completed season both as the active result and as its latest historical archive. Loading verifies that archive once and reuses its computed result only when the active season has the same seed, model, actual team inputs and official played games. Playoff reuse also requires the same game count and official overrides. Each replayable archived season still receives its full replay and validation; legacy summary-only records retain their existing validation. Active results and historical records remain independent copies, and the active engine's original team header is preserved for strict serialized-result comparison. Partial seasons and different inputs follow their usual replay path.

## Repeatable measurements

Run one benchmark phase at a time, with other CPU-heavy work stopped. Module loading and eight warmup games precede the timer. Timings describe engine work on the current machine; browser startup and storage costs vary.

```sh
npm run performance:audit -- --phase=season --output=/tmp/season-before.json
```

After a performance change, check the complete output against that baseline:

```sh
npm run performance:audit -- --phase=season --baseline=/tmp/season-before.json --output=/tmp/season-after.json
```

For a franchise, export a save through **Save options** and keep the input file unchanged between measurements. The benchmark reads the export through the real validation and deferred restoration code without writing to browser storage or the export.

```sh
npm run performance:audit -- --phase=save --save=/path/to/export.json --output=/tmp/save-before.json
npm run performance:audit -- --phase=save --save=/path/to/export.json --baseline=/tmp/save-before.json --output=/tmp/save-after.json
```

Add `--profile=/tmp/season.cpuprofile` to capture a CPU profile for the timed phase. Use the same profiling option for both measurements. Reports include the output hash and serialized size; save reports also identify the input hash and number of games verified. A baseline comparison fails if the input or complete output differs. Timing ratios are reported separately from correctness checks.

One profiled before/after sample on the same Apple Silicon machine (Node 24.19.0):

| Workload | Before | After | Time saved |
| --- | ---: | ---: | ---: |
| Complete 1,230-game season | 63.90 s | 49.93 s | 21.9% |
| Two-year offseason franchise restoration | 178.06 s | 88.64 s | 50.2% |

Both complete serialized outputs retained their original SHA-256 hashes and lengths. The restored franchise verifies 2,620 unique regular-season and playoff games; all retained years remain present. These are single-run engine measurements, not a promise about browser loading times. Inputs, environment, exact timings and output fingerprints are recorded in [performance-audit.json](performance-audit.json).
