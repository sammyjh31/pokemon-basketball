# Connected franchise seasons

The user explicitly selected five additions and requested continued commits/pushes: playable scheduled regular-season and playoff games; an eight-player rotation/minutes editor with a closing five; individual training plans; player career pages; historical game boxes. Implement all five together while retaining 240 unique Gen I–II players and current saved results. This extends the earlier short-game design to playoffs.

## Playing a season

A franchise coach can play the next user fixture, simulate one league round, or simulate the remaining regular season. Official arcade games last four one-minute quarters, with 25-second overtimes, and score/counting statistics scale by 12. Show actual and official scores explicitly. Both boxes conserve 240 regulation player-minutes (25 additional per overtime). Count appearances, starts and game honors once; a DNP is not an appearance. Every accepted regular result advances all 15 fixtures in its round. Saved played results are authoritative; other games replay deterministically. Playoffs allow the same user-controlled fixtures and retain best-of-seven progression and Finals MVP. Practice exhibitions remain independent.

Progress is a bounded prefix of the 82 rounds with played overrides. Completion exposes final awards/qualification. Lock lineup, minutes and coaching after the first fixture. Results bind to run identity and expected fixture; stale/duplicate/tied/unfinished/wrong-roster submissions cannot count. Final results auto-record once and offer Continue season; unfinished exits leave the fixture pending. Loading preserves authoritative boxes and validates arithmetic/identity. Midgame checkpointing is excluded.

## Coaching

Rotation plans allocate integer target minutes 0–48 to all eight slots, total exactly 240, with five distinct positive-minute closing slots. Existing roster swaps determine starters and reserves. The engine uses targets and the closing unit subject to fouls and overtime; actual minutes can differ. Existing preset rotations remain available; no custom plan leaves old arithmetic unchanged.

Training focuses: balanced, shooting, defense, playmaking, conditioning and position, with a target position for the latter. Intensity: steady, standard, aggressive. Plans belong to the user's current players and apply at the next unprocessed offseason. Targeted growth trades away general gains, and aggressive plans add volatility. Keep the user's large-swing development preference and annual/cumulative bounds. Plans can be edited during the season or a processed offseason for the following year; they never reroll past reports. Trades remove plans for departed players.

## Careers and history

New archives retain frozen season teams, played overrides, per-player regular and playoff totals, and playoff replay metadata. Game lists and boxes regenerate on demand from frozen inputs; official boxes use stored overrides. Player pages show current skills, season rows, teams, development trajectory, honors and rings, with separate regular/playoff views. Previously discarded old-season details cannot be invented: clearly label unavailable old years while preserving their career aggregates and honors. Archive the current completed year when possible, even if it began before this upgrade.

Use franchise model 3, regular-season model 6 for interactive/custom-rotation inputs, and playoff model 2 when official overrides exist. Retain old paths for no-extension models. Validate new offsets/rotation/training/progress/archive inputs, permit legitimate DNPs, preserve damaged source bytes, and keep storage failures visible with retry. Store frozen inputs and player totals rather than every simulated game's 16 boxes.

## Delivery

Partition independent engine/coaching/archive work with explicit interfaces; integrate app flows centrally. Tests cover conversion, uniqueness, full mixed seasons, playoffs, exactly-once accounting, DNPs, custom minutes, training effects, old/new save restoration, archive replay and user flows. Browser-check one official game, coaching, careers, historical boxes and narrow layouts. Commit coherent tested milestones and push main without force.
