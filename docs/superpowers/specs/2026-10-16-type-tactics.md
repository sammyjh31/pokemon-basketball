# Type tactics and opponent learning

Implement the requested defensive assignments, screening decisions, help rotations and between-game learning in simulated seasons and playoffs. Keep basketball ratings, fatigue, foul rules and custom rotations authoritative.

New rules opt in through typeTacticsVersion: 1 alongside typeMatchupsVersion: 1. New runs/local drafts and new franchise seasons activate them; older saved inputs preserve existing behavior. Existing local careers keep their saved rules. Arcade remains on its existing mechanics, but completed official games can supply box-score scouting observations.

Defenses assign five distinct defenders to the current opposing five using role/physical fit, type resistance and observed scoring threats. Assignments refresh when either lineup changes and each minute as fatigue changes. Offenses select useful screen partners. Defenses compare switching with staying; offenses can use the ball handler, roller or perimeter outlet. Rim help weighs resistance and interior defense against the shooter it abandons. A successful read can create a kick-out three, with a bounded late-closeout effect. All random choices use the game seed; diagnostics never consume random draws.

Opponent scouting is derived only from completed games. It tracks opponent shot attempts, field-goal points, shot zones, screens and defensive responses, using discounted observations so recent meetings matter. A coach's context belongs to that specific opponent. New seasons begin with empty memory; playoffs inherit the regular season and update after each game. No result or future fixture is consulted while preparing a matchup.

Each game summary stores its pregame scouting context for exact box-score reconstruction. Final league state and active playoff brackets store derived scouting for continuation. Playoffs retain only surviving qualifiers and remove continuation memory after the championship; frozen game contexts remain available. Season and playoff replay rebuild memories in chronological order and existing save validation compares reconstructed results, preventing injected scouting from silently rewriting results. All match-detail callers must pass saved context.

Reports expose prior meetings, observed primary threats, cross-match assignments, switches, rolls, help and kick-outs. They distinguish defensive and offensive counts and explain learning without claiming it guarantees wins.

Verification: domain counterexamples, fatigue/role constraints, no duplicate defenders, screen-stay/switch cases, help/kick-out tradeoffs, opponent isolation, no input mutation/future leakage, sync/async and stepped/batched equivalence, regular-to-playoff carryover, exact detail replay, old-rule digests, malformed version rejection, save/restore, full suite and build.
