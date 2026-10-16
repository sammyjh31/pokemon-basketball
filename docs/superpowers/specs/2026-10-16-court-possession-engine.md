# Court positioning, possession sequences and screen defense

The user selected these three engine additions and authorized implementation, commits and GitHub pushes. The purpose is for roster construction, Pokémon bodies/typing and coaching to change outcomes in every simulated game, with inspectable evidence.

## Design

Use one versioned, discrete half-court model inside `simulateMatch`. Ten players occupy court coordinates in feet. Offense starts in role- and shooting-dependent spots; defense shades toward the basket according to shooting threat. Distances affect passing risk, help arrival, driving congestion, shot contests, and recovery. Body mass/reach, speed, energy, passing and typing retain meaningful effects. These are game-design estimates, not measured Pokémon anatomy or real basketball tracking.

Each possession can screen, drive, pass, kick out, reset, or shoot. Actions consume actual game and shot-clock time. A fresh possession has 24 seconds; an offensive rebound resets to 14; a defensive non-shooting foul preserves at least 14. Period expiration caps available time. If the period cannot supply the initial advance, a rushed heave consumes the remaining time; distant attempts receive a range penalty. No completed action or shot borrows time from the next period. Failed reads and trapped passing lanes can cause turnovers; failed actions can flow into another attack. Bound action loops and shot odds. All points still arise from recorded baskets and free throws.

Screen defense chooses drop, switch, hedge, trap or under using handler shooting/handling, roll threat, defender mobility/body matchups, typing and the team's defensive scheme. Each coverage moves defenders differently and has a cost: drop concedes pull-ups, under concedes space, switching risks mismatches, hedge requires recovery, trapping opens the roll/weak side. Use the resulting geometry and actual defender for the final shot; avoid stacking the legacy generic screen/help bonuses.

## Integration and compatibility

Optional `courtVersion: 1` pins this ruleset on Run, LeagueTeam and local-league inputs. New runs and new local leagues opt in; standard franchises upgrade at the next season boundary. Existing local career rules remain frozen. Legacy rules never consume new RNG or gain telemetry. Archives preserve their team versions; reject unsupported or mixed court versions. All simulated regular-season, CPU, playoff and reconstructed historical games use the same entry point. User-controlled arcade play remains its own physics engine; CPU/simulated fixtures surrounding played games use this model.

The new clock advances player minutes/fatigue and lineup time by actual possession durations, with substitutions between possessions and immediate foul-out replacements. Legacy ticking remains byte-identical. Full versus compact telemetry must not change results. Eight-player rosters, draft/trade/free-agency flows stay intact.

## Evidence in the product

Game insights show coverage usage, multi-action sequences, late-clock shots, shot-clock turnovers, and individual possession action chains. Include a final court diagram with actual simulated positions and a legend. Shot-chart coordinates for this model come from the simulated shooter position; older charts retain their schematic label. Historical games without sequence evidence explicitly say it was not recorded.

## Verification

Controlled fixtures compare spacing/crowding, coverage tradeoffs, passing under pressure, body mobility/recovery, shot clocks and short periods. Integration checks scoring, player minutes, per-team possession counts, deterministic seeds, identical compact/full results, CPU games, playoffs, and save/archive compatibility. Freeze representative legacy game outputs before changes and compare byte-for-byte afterward. Run the complete suite, build, browser QA on a separate origin/save, and a seeded multi-team balance/performance audit. Commit and push the finished work.
