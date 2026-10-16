# League model 3

The game simulates one shared 30-team, 82-round season. This is a fictional basketball model, not a forecast of real-world athletic performance. Its complexity represents lineup decisions and possession outcomes; no winner is chosen independently of the box score.

## Rosters and schedule

The player's eight selections are reserved first. The other 29 teams draft eight each from the remaining Gen I–II pool. No species appears on two teams. With legendaries/mythicals disabled, all 240 eligible species are drafted; with them enabled, 240 of 251 species play.

A seeded snake draft balances pick order. During the first five rounds, each candidate is evaluated at its best remaining vacant starter role; the final three rounds fill reserves. Each club weighs positional fit (85%) and its coaching preference (15%), then selects from its top four remaining candidates. Clubs have persistent offensive, defensive and rotation preferences for the season. Player identity includes both team and Pokédex ID.

A circle schedule plays all 29 opponents home and away (58 games). Twelve additional pairings are played home and away (24 games). Every team plays once per round, 82 times total, with 41 home and 41 away games. These are 1,230 games, not 30 independently simulated schedules. The league seed fixes draft order, schedule and each match's seed.

## Match decisions

The clock advances in 7.5-second steps. Normal substitutions are evaluated every minute using planned minutes, positional coverage, accumulated workload, energy and foul trouble. Close games prefer a closing lineup in the final four minutes. Bench players recover energy; halftime and quarter breaks add recovery. Pressing and fast pace cost extra energy.

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

Simulation yields between 15-game rounds and reports progress. Roster and coaching edits are locked during calculation; a completion applies only if the source run is still current. The reducer counts it once. No partial season is saved.

Restoration also yields between rounds, so the app renders a progress indicator before validating a completed league. Original saved bytes remain untouched until validation succeeds or the user explicitly replaces the state. A valid shared-lineup import can replace a damaged save and subsequently persist normally.

Any future change to event probabilities, roster draft, schedule, aggregation, rating inputs or award formulas can change deterministic output. Preserve model 3 and introduce a new model version before shipping such a change to users with saved model-3 results.

Playoffs are an optional `run.playoffs` extension with their own `modelVersion: 1`; the regular-season payload remains unchanged. Saves retain seeds, the 15-series bracket, game summaries, postseason aggregates and Finals aggregates. Loading checks the extension against a deterministic replay bounded at 105 games. Valid completed model-3 seasons without an extension can start playoffs immediately. A damaged playoff extension recovers the valid regular season with a notice while retaining original saved bytes until explicit replacement. Older model-1/2 recaps cannot invent a league bracket. Preserve both the regular-season and playoff models before future match-engine changes.
