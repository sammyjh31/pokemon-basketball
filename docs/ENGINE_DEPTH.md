# Engine depth, measurement and tuning

New leagues opt into `LeagueTeam.engineRules` version 1. A missing rules object preserves the original engine, including the exact random draw order and original result shape. Model 2 itself remains separately selected by `simulationVersion: 2`. Golden replay tests cover both existing engines at seeds 1, 42, 400 and 8901. New leagues enable signatures by default; the team rules contain the toggle. Human teams can retain manual coaching by setting `adaptiveCoaching: false`.

The coefficients below are game-design choices. They were not fitted to professional basketball data or Pokémon outcomes.

## Physical traits and individual preferences

The existing ratings already derive strength, movement, stamina, rebounding and finishing from size. The new rules add **small supplemental** effects; they do not replace the earlier ratings or feed their changes back into those derivations.

- Reach uses `tanh(log(1 + height) / 1.8)`, bounded from 0 to 1. Mass uses `tanh(log(weight / 80) / 2.2)`, bounded from -1 to 1.
- Reach and mass together add at most 6 rebounding attribute points. Reach adds at most 3 block points. Mass adds at most 5 screening and 4 contact-strength points. All effective attributes remain bounded.
- Larger frames lose at most 5.5 movement points and pay at most 0.28 extra energy per minute on court. This is ordinary match fatigue, with bench recovery; there are no injuries or career deterioration.
- A physical shot adjustment is capped at ±2.5 percentage points. The existing model-2 height matchup remains, so the audit reports the full older size effect separately from the added layer.
- Species identity sets independent usage, zone and passing preferences through a deterministic hash. Zone weights range from 0.8 to 1.2; usage from 0.88 to 1.12. These influence who takes a shot and which shot they choose. They do not directly increase accuracy. The hash never consumes match RNG.

`engineProfile(pokemon)` exposes the physical values, preference description, signature and readable scouting text. Equal basketball attributes do not imply identical preferences.

## Teamwork and signatures

Chemistry uses the best **three distinct teammates** providing passing, spacing and finishing. A single star cannot fill all three roles. Complementary skill contributes at most 1 percentage point of shot probability. Continuity (`familiarity`, 0–1) contributes up to 0.6 more. Their combined bonus also lowers turnover probability by at most 0.96 percentage points. Lineup chemistry is recomputed for each distinct group; traded lineups can lose continuity according to career rules.

Signatures apply only when their situation is active. A shooter contributes at most 1.2 percentage points, a passer 0.8, and a defender subtracts at most 1. Every final shot probability stays within 10–88%. The per-team ability toggle removes every signature bonus without disabling tendencies or size.

| Signature           | Situation                                  | Probability change   |
| ------------------- | ------------------------------------------ | -------------------- |
| Quick first step    | Transition shot                            | +1.2 pp              |
| Set-shot rhythm     | Spot-up three                              | +1.2 pp              |
| Strong finish       | Post shot at the rim                       | +1.2 pp              |
| Passing vision      | Pass to a pick-and-roll or spot-up shooter | +0.8 pp for teammate |
| Paint anchor        | Defending the rim with energy above 40     | −1.0 pp for opponent |
| Closeout specialist | Contested perimeter shot                   | −0.8 pp for opponent |
| Steady hands        | Clutch shot                                | +1.2 pp              |
| Second jump         | Second-chance rim attempt                  | +1.2 pp              |

Signatures derive from the first species type and are basketball analogies, not copies of the main-series battle mechanics. They never trigger evolutions or change species.

## Coaching and recorded defensive events

At period breaks, enabled coaches evaluate the previous period, with at least eight opponent shot events before changing coverage. At least 40% perimeter attempts prompts switching; at least 48% rim attempts prompts a zone; otherwise the coach returns to man defense. Offensive changes consider the opponent's **previously observed** coverage and the team's own last-period finishing: a zone or poor rim finishing encourages perimeter play; poor perimeter finishing encourages interior play. Each change logs the counts, previous choice, new choice, period and reason. Both coaches see the same pre-adjustment state. No future random outcome or same-break opposing decision is inspected. Adaptation is a heuristic, not a guaranteed scoring boost.

A contest is explicitly resolved before the shot and changes its accuracy (−0.8 pp when contested, +1.2 pp when open). Coverage probability depends on defender closeout and shooter movement. A tipped pass that remains with the offense lowers the ensuing shot accuracy by 1.2 pp; the event can also be followed by a foul instead of a shot. Steals count as stolen deflections. These event counts are not estimates reverse-engineered from final boxes.

## Telemetry contract

`LeagueMatch.insights` is present for depth matches. `simulateMatch(home, away, seed, { collectInsights: false })` omits the returned detail, preserving the exact gameplay result; internal evidence remains available for coaching. Reporting and schematic-coordinate generation never call the gameplay RNG.

- **Shots:** actual shooter and assigned defender IDs (`team:species`), optional blocker, period, elapsed seconds, play, zone, value, make/block/foul, contest and expected probability. A shooting-foul miss has `countsAsAttempt: false`; an and-one has `true`. All made field goals, official attempts and field-goal points reconcile to player boxes.
- **Expected probability:** ordinary attempts include the block probability; a shooting-foul event instead stores its conditional and-one probability. Sum expected points across all events, including foul events, when comparing against recorded field-goal points. It excludes free-throw value. The older `shotQuality` field keeps its historical narrower ordinary-attempt definition.
- **Coordinates:** `coordinateSystem: "schematic-half-court"`; x/y are 0–100, the hoop is near (50, 10), and deterministic angle/radius hashes illustrate each zone. Coordinates are not simulated positions or tracking data. Multiple attempts can share a clock tick.
- **Lineups:** five unique sorted player IDs, seconds on court, offensive possessions **started**, points for and points against. Every team's time and scoring totals reconcile. A foul-out can change players mid-possession: points are credited to the actual group on court, and its possession denominator can be zero. Do not present points-per-start as a conventional defensive rating. Instantaneous groups can have zero elapsed seconds and nonzero scoring.
- **Defense:** assigned shot-event count (`matchups`), official attempts, explicit contests, field-goal points allowed, expected field-goal points, actual blocks/steals/deflections and shooting fouls. No free throws are attributed to a shot defender. A helper blocker can differ from the assigned defender. These are assignment/event statistics, not a causal estimate of individual defensive impact.
- **Missing detail:** older matches remain valid without this optional structure. Reconstruct new-match detail from frozen inputs; do not fabricate events for historical matches.

## Reproducible evidence

Run from the repository root:

```sh
node scripts/balance-audit.mjs --samples=200 --out=docs/engine-balance-audit.json
npm test -- --run src/game/engineDepth.test.ts src/game/engineProfile.test.ts src/game/match.test.ts
```

The recorded audit uses seeds 424200–424399 for 3,600 games: a strong reference roster, all five styles, paired side-swapped ability/continuity/coaching comparisons, old/new physical cohorts and randomly filled rosters across all 1,025 species. Random roster selection begins at seed 714200. The 200-game random-catalog cohort has no position optimizer, so its variation includes lineup fit.

| Measurement                         | Existing model 2 | Depth rules v1 |
| ----------------------------------- | ---------------: | -------------: |
| Reference mean team points          |           120.26 |         124.99 |
| Reference mean possessions          |            98.32 |          99.15 |
| Reference team-score p10–p90        |          103–139 |        108–143 |
| Large physical cohort win rate      |           68.25% |         74.00% |
| Large physical cohort paired margin |            +7.29 |         +12.17 |

The large cohort is 3 m / 300 kg versus 0.5 m / 15 kg, with equal source stats and types. The additional layer changes its paired margin by +4.87 points and win rate by +5.75 percentage points; it also changes tendencies, chemistry and contest events, so this **difference-in-differences is not an isolated physical causal estimate**. The distinct species IDs retain individual preferences. A separate 400-game test holds basketball ratings constant and verifies that extra size raises the fraction of rebound opportunities won.

Other recorded results:

- Signature-on versus signature-off paired margin: **+0.675 points**, 52.75% treatment wins. The audit fails if the absolute paired mean exceeds **3 points**.
- Established versus new continuity: **+1.99 points**, 54.0% treatment wins.
- Adaptive versus fixed perimeter coaching: **−0.42 points**, 50.0% treatment wins. It reacts to evidence but offers no assured advantage.
- Ordinary-shot expected make rate **49.99%**, observed **49.95%**. This is an internal probability consistency check, not external calibration.
- Random full-catalog team scores average **115.39**; p10–p90 **96–134**, minimum **74**, maximum **159**. Uneven skills and unoptimized positions produce real blowouts (largest observed margin 54).
- Pace versus defensive style: **106.89 versus 93.90 possessions**. Perimeter versus interior style: **62.23 versus 17.71 three-point attempts** for the tested reference roster.

The script exits nonzero if its documented score/tempo/efficiency, probability residual, ability swing, physical win-rate or style-direction guardrails fail. These broad regression ranges are tuning checks, not a promise for every roster or every seed. Changing coefficients requires rerunning the audit and updating this evidence.

## Court version 3 balance pass

Court version 3 (`COURT_VERSION` in `courtTypes.ts`) is the default for new runs, new local leagues and the next franchise season. Versions 1 and 2 replay byte-identically; `courtVersion3.test.ts` pins version-2 match, development and honors fingerprints that were verified against the unmodified version-2 commit. Raw evidence is in [balance-v3-audit.json](balance-v3-audit.json); formulas are in [the league model](LEAGUE_MODEL.md#court-version-3-balance-rules).

600 league games, same clubs and seeds, with main's trainer coaches, abilities, chemistry, chemistry growth, morale, personalities and shared evaluation enabled for both versions (`node scripts/court-metrics.mjs --court=N --games=600`):

| Measurement            | Version 2 | Version 3 |
| ---------------------- | --------: | --------: |
| Average margin         |      16.4 |      11.4 |
| Games decided by 20+   |     31.0% |     15.8% |
| Games within 5         |     16.2% |     25.7% |
| Overtime               |      2.0% |      2.5% |
| Points per team        |     111.9 |       111 |
| Pace                   |     101.6 |     101.6 |
| Offensive rebound rate |     22.7% |     22.3% |

Full seasons and eight-season careers (`node scripts/balance-metrics.mjs --court=N --legends=L --seasons=8`). The career loop develops every player each offseason but has no trades, free agency or rookie drafts, so it isolates the development formula.

| Measurement                              |  v2, no legends | v3, no legends |     v2, legends |    v3, legends |
| ---------------------------------------- | --------------: | -------------: | --------------: | -------------: |
| Year-1 top rebounder (RPG)               |            21.9 |           14.1 |            20.2 |           15.9 |
| Year-1 top scorer (PPG)                  |            30.7 |             30 |            36.7 |           33.7 |
| Year-1 height/RPG correlation            |            0.63 |           0.56 |            0.61 |           0.59 |
| Year-1 height/PPG correlation            |            0.43 |           0.37 |            0.42 |           0.38 |
| Year-1 MVP line (PPG/RPG/APG)            |   29.1/21.9/3.2 |  28.1/10.3/6.5 |  22.9/19.8/14.9 |  30.3/13.9/6.9 |
| Year-8 top scorer (PPG)                  |            83.1 |           35.5 |            73.6 |           33.5 |
| Year-8 top rebounder (RPG)               |            27.6 |           16.9 |            27.6 |           16.3 |
| Rating SD, year 1 → year 8               |     11.1 → 21.5 |    11.1 → 11.1 |     10.3 → 21.4 |    10.3 → 10.8 |
| Cumulative change, 28+ / 15–28 / <15 MPG | +3.9/−6.9/−10.4 | −4.5/−0.3/+7.8 | +3.4/−9.9/−10.0 | −5.2/−1.9/+8.1 |
| Average margin, seasons 1–8              |       15.0–20.6 |      11.5–12.4 |       15.8–21.1 |      10.9–11.9 |
| Games decided by 20+, seasons 1–8        |     29.1%–44.8% |    15.7%–19.0% |     30.4%–46.0% |    14.5%–18.1% |

Notes and limits:

- Across eight seasons, version-3 margins stay at 11.5–12.4 (no legends) and 10.9–11.9 (legends), with 15.7%–19.0% and 14.5%–18.1% of games decided by 20+. Overtime rises only to about 2.5–3%; the NBA's ~6% would need a stronger catch-up effect than seems fair.
- Rebound leaders still play about 41–42 minutes; garbage time trims decided games but rotation targets are unchanged.
- The <15 MPG group gains under version 3 because the parity term lifts weak species toward the league mean while regression pulls strong ones back. Breakouts and slumps still occur (`balancedDevelopment.test.ts`).
- Defensive Player of the Year uses club points allowed per game. Individual points-allowed-versus-expected is recorded in game insights but not aggregated into season player rows; adding it would change saved row shapes.
