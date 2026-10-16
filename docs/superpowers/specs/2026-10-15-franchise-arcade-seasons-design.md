# Play franchise season games in arcade

## Intent and agreed choice

The user wants to control the five-on-five arcade team in scheduled franchise games and have those results count toward the season. They chose **short games with the score and statistics scaled to a full game**. Preserve existing franchise history, trades, careers, development, CPU transactions, and saved seasons.

This is an architectural integration: the existing season is simulated in one operation and verified by deterministic replay on reload; arcade currently owns a separate, unsaved exhibition. Official played games need persistent results that replay cannot replace.

## Player experience

- For an unplayed franchise season, show the next scheduled opponent, home/away, game number, and three actions: **Play next game**, **Simulate next game**, and **Simulate remaining season**.
- Play next game opens an official arcade matchup using the scheduled opponent and both clubs' current season rosters and developed ratings. Opponent selection and exhibition rematches are unavailable for official fixtures.
- When the final buzzer resolves, record that game exactly once and simulate the other 14 games in the same league round. Update both teams' records, all player totals, league standings, leaders, and live career totals together. Final results remain visible with **Continue season**.
- Played and simulated fixtures can be mixed throughout the 82-game schedule. Mark played games in the schedule; opening their box scores always shows the saved played result.
- Awards and playoff qualification finalize only after all 82 rounds. Existing playoff simulation, offseason processing, trades, and career/history archiving continue afterward.
- Keep the independent exhibition entry for practice. Exhibition results never count.
- Existing completed seasons and archived years remain unchanged. Official arcade play becomes available in an unplayed current franchise season or the next season.

## Clock and statistical conversion

Use four one-minute quarters and the existing 14-second possession clock. Convert the official match by **×12**:

- A 10–14 court result becomes a 120–168 season result. The winner and margin direction stay the same.
- Multiply points, made/attempted shots, offensive/defensive rebounds, assists, steals, blocks, turnovers, and plus/minus by 12. Shooting percentages remain unchanged. Preserve shot-location accounting so two-pointers, threes, and total points reconcile.
- Scale playing time to 48 regulation minutes per team, or 240 player-minutes. Use deterministic eighth-minute allocation to maintain exact totals and compatibility with stored statistical precision.
- Games played, games started, player-of-game awards, double/triple-double counts, and high-game records are **derived once from the official converted box**, never multiplied as counters. A reserve who does not play has no appearance.
- Official overtime lasts 25 real seconds, converted to five regulation minutes; repeat until the score is untied. Exhibition overtime remains 30 seconds.
- Arcade has no fouls or free throws, so those categories remain zero for played games.

Show the court score and the projected season score during play. Results clearly label **Season totals · ×12**, retain the actual court score, and show the converted box that enters league records. Scaling is an arcade convention; one action can produce a large change in season totals.

## Season state and save handling

Introduce a versioned season-progress record separate from the existing completed-season result. It stores the completed round count, frozen season inputs, and the official boxes for played fixtures. Rebuild derived standings and totals from this record plus deterministic simulation for CPU fixtures; do not independently increment multiple copies of a result.

Each accepted result is bound to the franchise year, run ID, fixture ID, next round, and original participating rosters. Reject duplicate, stale, out-of-order, wrong-roster, unfinished, or tied submissions. Validate score arithmetic, roster identity, shooting splits, plus/minus, playing time, and reasonable bounded data before accepting or restoring a played result.

Lock the season's starting rotation and coaching after its first fixture, matching the current full-season model. In-game bench substitutions remain available. Do not permit midseason trades or arbitrary species replacement.

At round 82, derive the completed season from the same mixed results. The played boxes remain authoritative for saved game details and validation. Reloading or simulating the remaining schedule must not replace any played result.

Completed fixtures autosave. If storage fails, keep the result in memory, display the save failure, and offer retry without submitting the fixture twice. An unfinished game can be exited with a clear warning; it does not count and its fixture remains pending. Reloading during an unfinished game restarts that fixture. Midgame checkpoint/resume is outside this first implementation.

## Compatibility with franchise development

The active development work introduces season model 5 and franchise model 2. Integrate against that completed work, preserving its developed player inputs and offseason processing. Do not modify or commit another task's in-progress edits.

Use a new mixed-season model and a versioned franchise extension for interactive-season archives. Retain historical validators for old models. New archive validation must support DNP reserves and recorded actual starts rather than assuming every player appeared in all 82 games. Career and award accounting must use the converted official statistics exactly once, including after offseason processing and subsequent reloads.

Do not change deterministic outputs or save interpretation for previous regular-season, playoff, or franchise models. Preserve original save bytes when validation fails; never silently drop played results or franchise history.

## Verification requirements

1. Complete an arcade fixture; verify converted score/boxes, both teams' standings, other 14 fixtures, careers, and next opponent.
2. Mix played and simulated fixtures, reload midseason, and finish with simulation. Previously played scores and boxes must remain identical.
3. Submit the same completed match twice, use a stale source, or submit an unfinished/wrong-roster match; no duplicate or invalid result may count.
4. Verify home/away mapping, overtime, substitutions, DNP reserves, shot arithmetic, and exact minutes conservation.
5. Complete the season, simulate playoffs, archive it, process development/trades, start the next year, and reload. Verify career totals and past seasons remain intact.
6. Load existing legacy, franchise, and development saves unchanged; malformed interactive saves must preserve their source bytes.
7. Browser-test official entry, one completed game, season return, saved box score, refresh, and unchanged exhibition behavior on desktop and touch layouts.

## Scope

This first integration covers scheduled **regular-season franchise games**. Playable playoff games, midgame resume, online competitive integrity, and multiplayer are separate additions.

## Design status

User-approved: short games with scaled scores and statistics. The complete integration design above is ready for review before implementation planning.
