# Season and franchise performance

The performance pass preserves seeded outcomes and save formats. A frozen court-v4 regression checks the SHA-256 of the complete 1,230-game season, including boxes, league leaders, awards, scouting, morale, mastery and shared court history. Historical replay regressions continue to cover earlier rules.

Physical ability modifiers reuse immutable values for the same conditional effect and exact mastery multiplier. Each effect keeps at most 256 continuous-mastery variants. In-game chemistry identifies player groups with a match-local bitset and invalidates the cache when its inputs change. Recipient-indexed synergy bonuses retain the existing candidate order and strongest-source rules.

An offseason save contains the just-completed season both as the active result and as its latest historical archive. Loading verifies that archive once and reuses its computed result only when the active season has the same seed, model, actual team inputs and official played games. Playoff reuse also requires the same game count and official overrides. On a cold load each replayable archived season receives its full replay and validation; legacy summary-only records retain their existing validation. Later opens can reuse the verified evidence described below. Active results and historical records remain independent copies, and the active engine's original team header is preserved for strict serialized-result comparison. Partial seasons and different inputs follow their usual replay path.

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

## Verified franchise reopening

Solo franchises and local leagues retain optional verified replay evidence in a separate browser database. Unchanged archived years no longer replay their games on every opening. Offseason training choices and starting another season reuse those years; new games and new archived years still receive normal verification. Current-season snapshots remain independent of historical records.

The original save, backups and exports still contain the full history and remain authoritative. No simulation rules, seeds, save formats, statistics, mastery gains, chemistry or history limits change. Career ownership, trades, coaches, development and cross-year consistency checks still run. Cache evidence is bound to the complete input and the current engine/validator source revision and authenticated before use. Damaged, unavailable, evicted or obsolete evidence falls back to normal replay. First loads of existing/imported saves, another browser, cleared storage or a changed engine can therefore require a cold verification.

Cache storage is bounded at approximately 32 MiB, with 8 MiB per payload and two active snapshots per mode. Eviction prefers large old snapshots over small historical certificates. The cache never writes the source, backup or quarantine slots. Local career evidence contains only postgame team state and playoff seeds; saved news and statistics stay in their authenticated historical source.

Measure cold and warm openings of the same untouched franchise:

```sh
npm run performance:audit -- --phase=cached-save --save=/path/to/export.json --output=/tmp/cached-save.json
npm run performance:audit -- --phase=cached-save --save=/path/to/export.json --baseline=/tmp/cached-save.json
```

The `cached-save` phase also accepts an earlier ordinary `save` report as its baseline. `--phase=local-save` builds a deterministic ten-year, four-team, 14-game local career using the real simulation, coaches, offseason camps and rookie drafts. It measures restoration after fixture construction. Both phases open new cache instances over shared records, use real WebCrypto, compare complete cold/warm output hashes and fail if the warm opening replays games/years. Timings exclude browser startup and IndexedDB I/O; native browser reload/corruption checks cover those paths separately. CPU profiles remain available on the single `season` and `save` phases.

One cold/warm sample on the same Apple Silicon machine (Node 24.19.0, unprofiled):

| Workload | Cold verification | Warm reopening | Games/years replayed warm |
| --- | ---: | ---: | ---: |
| Same two-year 30-team offseason franchise | 92.66 s | 0.446 s | 0 games |
| Ten-year four-team local career described above | 13.55 s | 0.031 s | 0 years |

Both complete restored outputs matched between cold and warm openings. The two-year output also retains the exact hash and length recorded before this cache existed. All ten local years remain present. These are single-run engine measurements, not projected browser timings or extrapolations to other league sizes. Exact values, hashes and scope are in [performance-audit.json](performance-audit.json).

## Whole-season scoring pass (2026-10-21)

Simulated rotations now request numeric player scores without constructing scouting explanations. Five position evaluations share the same coached move value; base-role selection, morale, development, abilities and contribution addition order remain the same. Shared rotations also skip computing a fallback coaching plan whose result was unused. Chemistry compares the original ordered skill products before taking a single cube root and square root per unit.

A pinned current-rules full-season regression covers all seven generations, shiny attributes, signatures, move counters and learned counter outcomes. Its complete 1,230-game output retains SHA-256 `8d5825ff20de1b60b6a2e23afac6f02b43fbb33877523a78b38224841f393d36` (8,067,397 serialized characters). The older court-v4 fingerprint above remains a separate regression. Seed order, score arithmetic, game rules and saved formats are unchanged.

For a repeatable current-rules audit, use:

```sh
npm run performance:audit -- --phase=season --rules=current --output=/tmp/current-season.json
```

Use the same rules on a later `--baseline` comparison. The default remains the original legacy fixture. Benchmark reports reject mixed rule sets.

Six alternating 90-game samples on the same machine had median times of 8.63s before and 7.59s after (about 12% less time). Every complete sample output matched. This is a short-sample measurement, not a full-season speedup estimate or browser guarantee. Unrelated CPU-heavy simulation jobs overlapped the separate full-season runs, so their raw wall times cannot establish a speedup. Exact samples, raw full-season results and limitations are recorded in [performance-2026-10-21.json](performance-2026-10-21.json). Warmup and sample work remained outside user saves; no existing leagues were read or changed.
