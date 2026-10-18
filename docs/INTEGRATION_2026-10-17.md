# Court balance and game-flow integration

This integration combines PR #2 (court rules v3 balance) and PR #6 (game flow and deeper possessions) with the existing mastery, news, morale, chemistry, coaching and CPU-front-office systems.

## Compatibility

- New seasons adopt court rules v3 and game flow. Active seasons and archives retain their saved rules.
- Court rules v2 and v3 both support the game-flow possession actions: zone help, cuts, drifts, post seals and heat checks.
- Fixture snapshots preserve both ability mastery and game flow through regular games, playoffs, official games, historical boxes and franchise saves.
- Historical fixtures explicitly reconstruct their original flags. No golden replay fingerprint was changed.
- The original pre-CPU-rules offseason and next-season fingerprints remain `01d2d50fd0371c6547fd571f2f83d697d74eea0c871c849965bc8a20bde94f3b` and `26ccd5197862c428972164da424774bb9181348cc9515e1c92c8236062bbd10f`.

## Repairs found during integration

- Disabled abilities cannot override arena weather.
- Timeout substitutions preserve court-v3 garbage-time rest decisions.
- Local careers validate playoff eligibility and coach records using the actual v3 tiebreak seeds.
- Summary-only franchise histories allow individual DNPs. Known replay years still require exact appearances and box-score totals; current-year history is checked against the actual saved results.
- Test fixtures use matching mastery/roster metadata and correct historical rule flags. Training provenance is optional only for genuinely pre-mastery histories.

## Verification

The complete 234-file run finished in 42m 51s: 1,271 tests passed, 26 failed on the older fixtures/deadlines described below, and two tests were blocked by a setup-hook deadline. Every reported failure and blocked case was corrected and rerun, along with affected adjacent cases and a new exact-archive appearance guard: **34/34 passed across 17 files**.

The coverage audit maps every original failure to its passing replacement, including both historical/current physical-ability cases. Combined coverage is **1,300 passed, one intentionally skipped stress case, across 234 files**. The skip is the existing largest 30-club/50-season local-career stress test. Simulation/replay production code was unchanged between the complete run and correction reruns. See [the verification record](integration-2026-10-17-verification.json).

Typecheck and production build pass. Desktop/mobile browser verification is pending; PRs are not merged yet.

Persistence tests reconstruct 1,230-game regular seasons and playoff brackets. The former 120-second four-replay test took 175.89 seconds with no competing suite. Fixed generated test fixtures are cloned per case; production save validation still replays games. Corrupt free-agency ledger shapes use the production post-worker validation boundary with real independently simulated archives, while full save-load cases continue to cover valid ledgers, CPU transactions, multiple years, and preserved source bytes on rejection.

A 60-pair focused runtime sample on court v3 measured 37.38 ms/game without game flow and 39.53 ms/game with it (+5.7%). This is a runtime sample, not a new balance calibration. Existing balance audit tables describe the historical scenarios documented with those audits; they were not regenerated for the fully combined engine.

## Follow-up

Adaptable coaches currently target hot players after late timeouts; extending this targeting to run/rest timeouts remains a small coaching-policy follow-up. Existing hot/cold possession selection works independently.
