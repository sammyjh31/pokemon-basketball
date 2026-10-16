# League model 3

The game simulates one shared 30-team, 82-round season. This is a fictional basketball model, not a forecast of real-world athletic performance. Its complexity represents lineup decisions and possession outcomes; no winner is chosen independently of the box score.

## Rosters and schedule

The player's eight selections are reserved first. The other 29 teams draft eight each from the remaining Gen I–II pool. No species appears on two teams. With legendaries/mythicals disabled, all 240 eligible species are drafted; with them enabled, 240 of 251 species play.

A seeded snake draft balances pick order. During the first five rounds, each candidate is evaluated at its best remaining vacant starter role; the final three rounds fill reserves. Each club weighs positional fit (85%) and its coaching preference (15%), then selects from its top four remaining candidates. Clubs have persistent offensive, defensive and rotation preferences for the season. Player identity includes both team and Pokédex ID.

A circle schedule plays all 29 opponents home and away (58 games). Twelve additional pairings are played home and away (24 games). Every team plays once per round, 82 times total, with 41 home and 41 away games. These are 1,230 games, not 30 independently simulated schedules. The league seed fixes draft order, schedule and each match's seed.

## Match decisions

Court-enabled games (`courtVersion: 1`) advance the clock by each possession segment's actual duration; earlier saved rules retain 7.5-second steps. Normal substitutions are evaluated at the first possession boundary in each new minute using planned minutes, positional coverage, accumulated workload, energy and foul trouble. Close games prefer a closing lineup in the final four minutes. Bench players recover energy; halftime and quarter breaks add recovery. Pressing and fast pace cost extra energy.

Each possession chooses a handler and play type from transition, pick-and-roll, isolation, post or spot-up actions. Both teams use actual players and five-player floor lineups. Screens, passing, off-ball movement, shot preference, defensive matchups, help protection, closeouts and spacing affect shots. Switching changes pick-and-roll defenders; zones protect the rim while conceding perimeter opportunities; pressure trades turnovers for fouls and fatigue. Shooting fouls, and-ones, bonus free throws, offensive fouls and final-free-throw rebounds update both boxes. Play-type counts represent actions, including repeated actions after a foul or offensive rebound.

Six personal fouls normally remove a player immediately. If fewer than five eligible players remain, only the minimum disqualified players return, and subsequent fouls incur an extra technical free throw. This keeps the eight-player league playable. Late possessions include three-point chasing and intentional fouling. Ties continue into five-minute overtime periods until scoring produces a winner.

Every side records exactly 240 regulation player-minutes plus 25 per overtime. Individual minutes are fractional in eighth-minute increments. Every point comes from a recorded field goal or free throw; plus/minus applies to the five players on the floor. This is a discrete statistical model rather than a full rules-officiating or spatial physics simulator.

## Statistics and awards

Each event updates both teams' player boxes. Season production and standings accumulate from those same games. All 240 players appear in the league tables, and any of the 1,230 games can be reconstructed from its seed. Game honors can go to a player on either team.

All six season awards require at least 58 games. Sixth Player additionally requires starts in fewer than half the player's games. Each award shows its top three candidates. Ties resolve by team ID, then Pokédex ID. The two five-player selections are positionless.

- Raw impact per game = `(PTS + 1.2 REB + 1.5 AST + 3 STL + 3 BLK − 1.5 TOV − 0.4 missed FG − 0.4 missed FT) / GP`.
- Winning factor = `0.9 + 0.2 × team wins / 82`; availability factor = `0.9 + 0.1 × GP / 82`.
- League MVP and Sixth Player rank impact multiplied by both factors. All-League uses the MVP ranking.
- Defensive Player and All-Defense rank `(3 STL + 3 BLK + 0.65 DREB − 0.25 PF) / GP`, multiplied by both factors.
- Scoring, assist and rebound champions rank points, assists and total rebounds per game, respectively.

The leader table can show all players or qualified leaders. Qualification requires 58 games; percentage columns additionally require 300 field-goal attempts (FG% and TS%), 82 three-point attempts (3P%), or 125 free-throw attempts (FT%). Zero-denominator percentages and ratios display a dash. TS% uses `PTS / [2 × (FGA + 0.44 FTA)]`; per-36 figures use actual minutes. These thresholds are game rules, not claims about an external league's rules.

## Playoffs (postseason model 1)

The top 16 teams qualify by wins, then point differential, then team ID. This matches the default standings order. The first-round bracket is 1–16, 8–9, 4–13, 5–12, 2–15, 7–10, 3–14, 6–11. Adjacent winners advance without reseeding through quarterfinals, semifinals and Finals: 15 series total. Every series ends as soon as a team wins four games. The higher original seed hosts games 1, 2, 5 and 7; the lower seed hosts 3, 4 and 6.

Each action advances the next slate (one game per unfinished series in the current round), the rest of the current round, or the entire postseason. Later rounds wait until the active round finishes. All progression modes use the same per-series/game seeds and produce identical results. The original eight-player rosters and coaching settings carry into the playoffs. The existing match engine produces every score and box; no series winner is chosen separately.

Postseason totals start at zero for the 128 qualified players. They accumulate only playoff boxes; the regular-season league and challenge counters remain unchanged. Finals totals start fresh for the two finalists. Finals MVP is the champion's player with the highest total impact across Finals games: `PTS + 1.2 REB + 1.5 AST + 3 STL + 3 BLK − 1.5 TOV − 0.4 missed FG − 0.4 missed FT`, ties by Pokédex ID. Only players who appeared are eligible. The displayed PPG/RPG/APG are Finals-only averages. Postseason leader tables have no 58-game qualification rule; game counts remain visible for comparing sample sizes.

## Saving and compatibility

New seasons are model 3, saved at `pokemon-basketball:v3`. Saves include all team rosters, all game summaries, all player aggregates and both boxes for the user's 82 games. Other boxes are replayed on demand, keeping the save compact. Loading validates model-3 results by replaying the deterministic league. There is no server or anti-cheat claim.

Completed v1/v2 seasons retain their original results and records. Frozen `legacy*` and `v2*` modules reproduce those formats; the original 151 factual records remain byte-for-byte equivalent at the JSON-record level. New features apply to new seasons. Unfinished drafts keep existing selections and offers, then use the expanded pool for subsequent picks.

Simulation yields between 15-game rounds and reports progress. Roster and coaching edits are locked during calculation; a completion applies only if the source run is still current. The reducer counts it once. Legacy one-click seasons save only completed results; interactive model 6 persists completed schedule rounds.

Restoration also yields between rounds, so the app renders a progress indicator before validating a completed league. Original saved bytes remain untouched until validation succeeds or the user explicitly replaces the state. A valid shared-lineup import can replace a damaged save and subsequently persist normally.

Any future change to event probabilities, roster draft, schedule, aggregation, rating inputs or award formulas can change deterministic output. Preserve model 3 and introduce a new model version before shipping such a change to users with saved model-3 results.

Playoffs are an optional `run.playoffs` extension with their own `modelVersion: 1`; the regular-season payload remains unchanged. Saves retain seeds, the 15-series bracket, game summaries, postseason aggregates and Finals aggregates. Loading checks the extension against a deterministic replay bounded at 105 games. Valid completed model-3 seasons without an extension can start playoffs immediately. A damaged playoff extension recovers the valid regular season with a notice while retaining original saved bytes until explicit replacement. Older model-1/2 recaps cannot invent a league bracket. Preserve both the regular-season and playoff models before future match-engine changes.

## Franchise seasons

Franchise model 1 is an optional extension of the existing version-3 browser save. A completed ordinary league and Finals become franchise Year 1 when the user enters the offseason. Each subsequent year receives a new deterministic seed and an explicit 30-team roster input (`run.leagueTeams`), producing regular-season model 4. The match engine, schedule rules, league honors and playoff model remain the same. Ordinary model-3 inputs and results are unchanged.

The fixed input stores each club's eight members and coaching. Before tipoff, the user can swap their members between positions and edit coaching; they cannot import, draft or replace species. Those adjustments are applied to team 0 when constructing the season. Trades occur only after the Finals and exchange two existing members, preserving 240 unique Pokémon and eight players per club. Ratings are recalculated from the roster.

Trade ability is each player's highest rating across the five positions. From the partner club's perspective, let `abilityChange` be incoming minus outgoing ability and `fitChange` be its recalculated overall rating minus its previous rating, with the incoming player occupying the vacated slot. Reject if ability drops by more than 6, team fit drops by more than 1.25, or `abilityChange + 2 × fitChange < −2.5`. Otherwise accept. These deterministic game rules produce the preview and commit decision; there is no external AI service. Rosters can be reordered before the following season.

Career identity is species ID, not the season-specific `teamId:pokemonId` box-score key. Regular and postseason aggregates are independent. Counting fields sum across completed years, game highs take the maximum, and a current season can contribute derived live totals without being archived twice. Historical award/team attribution and championship rings use the roster from that year. Entering the offseason is idempotent; starting the next season clears the active result and bracket while preserving the franchise archive.

In franchise models 1/2, only the active season keeps game summaries and full replay inputs. Previous seasons retain 30 team records/rosters, award winners, honor teams, Finals result and Finals MVP; career totals retain player production. Active saves replay deterministically as before, while archived summaries undergo structural and cross-reference validation. These older archived summaries are not replayed on every refresh; franchise model 3 adds frozen replay archives and asynchronous validation as described below. A malformed franchise save is surfaced without silently overwriting its original bytes. Challenge attempt records are not incremented by later franchise years.

Lifecycle actions enforce the same 1,000-year and 10,000-trade bounds as save validation. Browser storage capacity may be reached sooner; a failed save produces a visible notice rather than claiming progress was saved.


## Development and CPU trades (franchise model 2 / season model 5)

Development runs once after a completed season is archived. Each of the 240 species keeps integer offsets for 17 primitive skills; shooting, playmaking and rebounding are recalculated summaries. Offsets are applied after the factual species/type baseline, without changing Pokémon facts. Annual changes are −10…+12, cumulative offsets −30…+30, and final skills 0…100. The match engine, rotations, advanced profiles, scouting, trade evaluation and arcade exhibitions all consume these skills.

Development uses regular-season production only. Let `MPG = minutes / GP`, `impact36 = impactPerGame × 36 / MPG`, reliability be `min(1, minutes / 1200)`, and ability be the best developed position rating. Opportunity is `2.4 × clamp((MPG − 22) / 14, −1, 1)`. Production is `3 × reliability × clamp((impact36 − (0.75 × ability − 12)) / 16, −1, 1)`. Form has a 35% chance of +4…+8, 35% chance of −8…−4, and otherwise −2…+2. It is seeded by season, species and year, so refreshes never reroll it.

Each skill adds shooting efficiency, assists/turnovers, steals, blocks, rebounding or conditioning evidence as applicable, with small-sample shrinkage. The final rounded change combines opportunity, production, form, skill evidence, regression `−previousOffset/10`, and independent noise of ±1.5, then applies the bounds above. The report records before/after best-position ratings, MPG, impact36, all skill deltas and explanations. A best-rating gain of at least 4 is a breakout, a loss of at least 4 is a slump, and changes within ±0.5 are steady. Form is deliberately volatile at the user's request; strong performance improves the odds but cannot guarantee growth.

CPU negotiation excludes team 0. For each club pair, candidate players must be within six best-position rating points. The two swaps with the strongest combined positional fit receive full rotation evaluation. Both clubs must gain at least 0.05 overall, with a combined gain of at least 0.15, and each must satisfy `abilityChange + 2 × fitChange ≥ −2.5`. Candidates rank by combined fit gain plus seeded noise up to 0.35. At most six non-overlapping club pairs trade, with at most one transaction per CPU club; no acceptable candidate means no forced trade. Cumulative development moves with the species.

New reports and CPU transaction metadata use franchise model 2. All 30 teams carry a development map owned by their eight players; offsets must reconstruct exactly from consecutive reports. A model-1 save starts development in its current offseason, without retroactively training older years. Active inputs use only prior offseasons, keeping this year's results frozen even after offseason training and trades. Developed fixed-roster inputs produce season model 5; no-offset model 3/4 and playoff model 1 retain their existing replay contract. Archived career totals and honors retain their existing attribution. Storage limits still apply and save failures are visible.


## Connected franchise play (franchise 3 / season 6 / played playoffs 2)

Model 6 advances an authoritative prefix of 0–82 schedule rounds. Every round includes the user's fixture and 14 CPU fixtures. Simulating a game or recording an arcade final rebuilds that prefix from frozen clubs and accepted played-game overrides, then publishes one immutable state change. The regular-season award set remains empty until round 82. The source Run object and fixture identity prevent stale or repeated callbacks from changing results or challenge records.

Official arcade games use four 60-second quarters and 25-second overtime periods. Scores and counting stats scale by 12. Minutes are apportioned in eighth-minute units to exactly 240 per club, plus 25 for each overtime, without granting appearances to DNPs; a player who appeared briefly retains a positive allocation. Starts, player-of-game awards and double/triple doubles are derived once from the official box. Court side 0 always represents the user, so away fixtures explicitly remap both score and box sides. Period scores, shot zones, plus/minus and overtime reconcile to the match totals. The official box is retained rather than simulated again later.

Played playoff games use the next eligible user fixture. Other series advance deterministically as needed to establish that fixture, then the played result enters the same best-of-seven bracket. A user who does not qualify or is eliminated can simulate the remaining postseason. Played results contribute to postseason leaders, Finals-only totals and Finals MVP.

Optional custom rotation inputs allocate integer 0–48 minutes to each of eight roster slots, totaling 240, and select five distinct positive-minute closing slots. Targets guide the existing substitution scorer; eligible reserves replace zero-minute starters, closing preferences apply in the late-game window, and foul depletion can require otherwise resting players. Rotation inputs participate in the profile cache key. Omitting a plan retains legacy arithmetic and random-number use exactly.

Training plans belong only to the user's current roster. A focus directs a fixed practice budget toward chosen skills (+9 divided across focus skills), with a general-skill opportunity cost (−10 divided across other primitive skills). Balanced focus adds no directional adjustment. Intensity scales the seeded camp form term (steady ×0.65, standard ×1, aggressive ×1.35), while annual and cumulative bounds remain unchanged. No plan, or balanced/standard, reproduces previous development exactly. Reports explain the applied plan. Plans for traded-out species are removed; future choices never mutate a completed report.

New archives store frozen 30-club inputs, regular/playoff player rows, the small playoff bracket and official results. Simulated boxes are derived on demand from those inputs; future trades, development or lineup changes cannot rewrite history. Current old-format offseason saves can capture their still-present final year when advancing; detail discarded in earlier years is never fabricated. Career validation handles actual appearances, including zero-game reserves, and separates preserved legacy totals from verified newer rows.

The legacy regular models 3/4/5, franchise models 1/2 and playoff model 1 remain valid. Any future changes to match probabilities, development, rotation or played conversion require preserving these versioned replay paths. Browser quota limits can precede the franchise's logical year limit; failures remain visible and retryable.
