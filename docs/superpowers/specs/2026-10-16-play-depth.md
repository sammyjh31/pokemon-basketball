# Play depth: zone defense, cuts, post seals and heat checks (proposed)

Status: proposed Phase 2 of the simulation-depth work. It builds on court rules v2 (PR #1: ball pressure, shot intent, catch assists) and game flow (`gameFlowVersion: 1`). It ships behind its own version flag, `playDepthVersion: 1`, which requires both. Nothing here is implemented yet.

Court geometry already places ten players, moves defenders back toward their assignments, resolves drives, help and kickouts, and (with v2) lets shooters relocate toward their intended zone. Three parts of the original design still have no geometric effect:

- Zone defense only adds sag and nudges screen-coverage planning. Defenders still guard men.
- Off-ball players never move after the formation is set. The `offBall` trait is unused in court mode.
- Post plays hand the ball to the screener at a fixed spot. The `postGame` trait is unused in court mode.

Heat checks are new. They connect the arcade's hot-streak idea to simulated games without a flat shooting bonus.

## Zone defense in geometry

When the defense plays zone, defenders guard areas instead of men. A 2-3 shell has five home spots: two at the top (±7, 24), two on the wings or blocks (±13, 11) and one in the middle (0, 8). Each spot shifts 35% toward the ball's x and 20% toward its y. The defender whose spot is nearest the ball guards it. During every action, recovery moves defenders toward their shifted spot rather than toward their man.

Zone strengths and weaknesses then come from positions rather than flat terms:

- The paint stays crowded, so drives meet more lane defenders and rim shots see more help.
- Skip passes find the weak side open, because a spot covers its area, not the shooter. Closeouts start from farther away, so corner and skip threes are more open.
- Good passing teams beat zones: the existing pass-read and candidate logic finds the open area.
- Zone defenders give up offensive rebounds more easily: box-out efficiency is ×0.85. They foul less (reach fouls ×0.85) and tire slightly less (drain ×0.95).

Man, switch and press keep today's geometry.

## Off-ball cuts and relocation

When a drive pulls a help defender, the attacker that defender left can react according to `offBall` skill:

- Cut. An interior attacker, or a guard whose defender is ball-watching, cuts to a dunker spot (±4, 6). Success chance is `clamp(0.25 + (offBall − 55) × 0.012, 0.1, 0.6)`, plus a bonus when the abandoning helper is more than 6 feet away. A successful cut is a catch near the rim; a failed cut leaves the cutter in traffic and adds a lane defender.
- Drift. A spacer with a three-point skill of at least 57 drifts along the arc toward the open corner or wing, by up to 6 feet, scaled by `offBall`.

Both spend real clock time and never move a player who already holds the ball. The pass logic then judges the new positions as usual.

## Post seals and doubles

On post plays, the court engine picks the post player by `postGame` and size, not by screening. The seal's depth is `clamp((postGame − defender interior defense) × 0.08 + (strength edge) × 0.05, −2, 4)` feet closer to the rim than today's (5, 10) catch point. A deep seal against a weak post defender draws a double team: the nearest help defender commits, and the post player can kick out to whoever that defender left. That uses the existing kickout and help reporting. Bad seals are pushed out, giving longer and harder shots.

## Heat checks

Each player tracks their recent shooting. A player is hot after three straight made field goals, or 8 points in the last 3 game minutes, and cools after a miss or 2 minutes without a shot. Hot players:

- get 1.3× weight as the handler and in the shooter-intent pick,
- shift their zone intent toward the arc (three weight ×1.5, mid ×1.2),
- shoot sooner in the possession (lower pass-read threshold).

There is no accuracy bonus. Hot players take more and harder shots, and the court geometry and shot model price that difficulty. A cold player, with four straight misses, gets 0.85× handler and intent weight until they make one. Coaches with adaptability of at least 0.7 run the next after-timeout play for a hot player.

Box scores report the moments when a player heated up or cooled off and how many shots they took while hot.

## Measurements to add

The audit compares zone against man by opponent passing quality: corner-three rate, rim attempts, offensive rebound rate and points per 100. It also counts cuts and drifts per game, post-touch efficiency by `postGame`, and heat-check shot volume against efficiency. The tuning goal is that zone helps against poor-passing, rim-heavy teams and hurts against good passing, while hot streaks change who shoots without lifting overall efficiency.

## Compatibility

All version-absent output stays byte-identical. The new rules run only with `playDepthVersion: 1`. They need court rules v2 and game flow, and adopt at the next season boundary like other rules.
