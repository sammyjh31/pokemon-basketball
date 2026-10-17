# Play depth: zone defense, cuts, post seals and heat checks

Status: implemented as part of game flow (`gameFlowVersion: 1`). These rules apply whenever game flow runs on court rules v2 (PR #1: ball pressure, shot intent, catch assists). Game flow on court rules v1, as in older local careers that keep frozen court rules, does not include them. Both ship together, so no save carries game flow v1 without them.

Court geometry already places ten players, moves defenders back toward their assignments, resolves drives, help and kickouts, and (with v2) lets shooters relocate toward their intended zone. Three parts of the original design still have no geometric effect:

- Zone defense only adds sag and nudges screen-coverage planning. Defenders still guard men.
- Off-ball players never move after the formation is set. The `offBall` trait is unused in court mode.
- Post plays hand the ball to the screener at a fixed spot. The `postGame` trait is unused in court mode.

Heat checks are new. They connect the arcade's hot-streak idea to simulated games without a flat shooting bonus.

## Zone defense in geometry

Zone defenders keep their assignments but play zone principles. A 2-3 shell gives each defender an area: two at the top (±7, 22), two on the wings (±16, 9) and one in the middle (0, 8). The guards go to the quickest perimeter defenders and the middle to the best interior defender and shot-blocker. Areas shift 40% toward the ball's x and 25% toward its y.

The defender on the ball pressures it at man depth. Every other defender sags from their mark toward their shifted area. The sag is `clamp(0.08 + 0.12 × distance from the ball / 30, 0.08, 0.22)` of the way, so the far side sags most. Recovery during every action moves defenders toward these targets.

Tuning came from forcing every possession into one scheme with the same teams and seeds:

| Defense | Points per sequence | Rim share | Three share | Defender distance at shot |
|---|---|---|---|---|
| Man | 0.980 | 0.478 | 0.378 | 3.72 ft |
| Zone | 1.002 | 0.440 | 0.423 | 3.67 ft |
| Main's older zone sag | about 7% above man | — | — | — |

Pure area-matching shells (defenders only take attackers inside their area) left shooters open after passes and gave up more than 25 extra points a game, so they were rejected. On top of the geometry, zone defenders box out less reliably (×0.85), commit fewer reach fouls (×0.85) and tire slightly less (drain ×0.95). Man, switch and press keep today's geometry.

## Off-ball cuts and relocation

When a drive pulls a help defender, the attacker that defender left can react according to `offBall` skill:

- Cut. An interior attacker, or a guard whose defender is ball-watching, cuts to a dunker spot (±4, 6). Success chance is `clamp(0.25 + (offBall − 55) × 0.012, 0.1, 0.6)`, plus a bonus when the abandoning helper is more than 6 feet away. A successful cut is a catch near the rim; a failed cut leaves the cutter in traffic and adds a lane defender.
- Drift. On every help rotation, the spacer nearest the ball (three-point skill of at least 57, on the arc) relocates: a wing sinks toward the corner and a corner lifts toward the wing, by `clamp(2 + (offBall − 50) × 0.1, 1, 6)` feet.

Both spend real clock time and never move a player who already holds the ball. The pass logic then judges the new positions as usual.

## Post seals and doubles

On post plays, the court engine picks the post player by `postGame` and size, not by screening. The seal's depth is `clamp((postGame − defender interior defense) × 0.08 + (strength edge) × 0.05, −2, 4)` feet closer to the rim than today's (5, 10) catch point. A deep seal against a weak post defender draws a double team: the nearest help defender commits, and the post player can kick out to whoever that defender left. That uses the existing kickout and help reporting. Bad seals are pushed out, giving longer and harder shots.

## Heat checks

Each player tracks their recent shooting. A player is hot after four straight made field goals, or three straight that include two threes. They cool after a miss or two minutes without a shot. Hot players:

- get 1.3× weight as the handler and in the shooter-intent pick,
- shift their zone intent toward the arc (three weight ×1.5, mid ×1.2),
- shoot sooner in the possession (lower pass-read threshold).

There is no accuracy bonus. Hot players take more and harder shots, and the court geometry and shot model price that difficulty. A cold player, with five straight misses, gets 0.85× handler and intent weight until they make one. Coaches with adaptability of at least 0.7 run the next after-timeout play for a hot player.

Box scores report when players heated up or went cold, and their field goals while hot. Cuts, drifts and seals appear as court actions in the possession viewer.

## Measurements to add

The audit compares zone against man by opponent passing quality: corner-three rate, rim attempts, offensive rebound rate and points per 100. It also counts cuts and drifts per game, post-touch efficiency by `postGame`, and heat-check shot volume against efficiency. The tuning goal is that zone helps against poor-passing, rim-heavy teams and hurts against good passing, while hot streaks change who shoots without lifting overall efficiency.

## Compatibility

All version-absent output stays byte-identical. These rules need game flow and court rules v2, and adopt at the next season boundary along with game flow.
