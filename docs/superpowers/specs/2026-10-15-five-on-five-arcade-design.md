# Five-on-five Pokémon arcade basketball

Status: proposed design for user review. The user selected five-on-five after comparing arcade basketball directions. Implementation has not started. Repository baseline examined: `36f760a`; concurrent playoff changes are present in the shared workspace and must be reconciled with the integration points before implementation.

## Intent and first milestone

Let the user directly play basketball with the Pokémon team they drafted. The user requested a simple arcade basketball game with NBA Jam flair, comparable to the playable games linked from All-22, and explicitly chose five-on-five.

Build a complete single-player exhibition: take the existing five starters and three reserves onto a court, play against a CPU team, finish a game, and see both teams' box scores. The game should feel responsive, make individual Pokémon recognizable, and reward movement, timing, passing, and defensive positioning.

Selected direction: Basketball Classics-inspired side-view basketball with court depth, plus turbo, exaggerated dunks, alley-oops, and hot streaks. Use an original implementation and the project's existing Pokémon assets. Inspiration links:

- [All-22 playable modes](https://all22pokemon.com/play)
- [Basketball Classics](https://playacclaim.com/basketball-classics/)
- [NBA Jam](https://arcade1up.com/blogs/product-info/nba-jam%E2%84%A2-arcade-machine)

The following are proposed defaults, rather than additional user requirements: four one-minute quarters, keyboard and touch controls, CPU opposition, a slightly elevated side view, and exhibition results separate from the simulated season. Review can change these choices.

## Player journey

1. Complete an eight-player roster in either existing draft mode.
2. Select **Play arcade** beside the season action. It remains available after completing a season.
3. See the starting five, bench, opponent selector, short controls guide, and **Tip off**. Default to the first available opponent. Opponent rosters come from the current league when available; otherwise generate them with the existing league roster builder without simulating a season.
4. Play four one-minute quarters. A visible pause button opens controls, audio/effects settings, and substitutions. Quarter breaks offer the same bench controls and a clear **Continue** button.
5. See final score, winner, player of the game, and eight-player tables for both clubs. Choose **Rematch**, **Change opponent**, or **Back to roster**.

Roster selection is copied at tipoff, so the exhibition owns its starting five and bench. Returning to the builder restores its previous view. An incomplete roster explains which slots need filling. A legacy five-player save asks the player to start an eight-player draft through the existing flow; it cannot silently replace their saved run.

Starting arcade is disabled while league simulation, restoration, or a pending lineup-import decision is active. Once arcade is open, the builder is not interactive. Leaving an unfinished match asks whether to abandon that exhibition. Refreshing does not resume a match; disclose this in the setup and pause help. Settings may persist independently.

## Court, camera, and presentation

- Use a wide hardwood court viewed from the sideline at a slight downward angle. Players move along the length and depth of the floor; jumping and ball flight have a separate height.
- Show both baskets and the full court at desktop and landscape-phone sizes. Position the score, quarter, game clock, and possession clock above the play area. Keep controls below the court.
- Draw players in floor-depth order. Ground shadows, team-colored rings, and a larger controlled-player marker distinguish height, team, and control even when sprites overlap. Names appear for the ball handler and controlled defender, with full names available in the pause roster.
- Use the existing pixel sprites, with distinct idle, run, dribble, pass, shoot, jump, dunk, block, and landing poses made from transforms and effects. The initial art approach is shared procedural animation, not a promise of hand-drawn animation frames for 251 species. Clamp sprite size so large species do not obscure entire lanes.
- Attach the ball consistently relative to the sprite and facing direction. Ball arcs and shadows must make it clear whether the ball is held, passed, shot, or loose. Art size does not silently determine collision radius or defensive reach.
- Add short dunk impacts, rim movement, speed trails, score popups, and an elemental hot-streak aura. Respect reduced motion by removing shake, flashes, and trails while retaining essential movement and shot feedback.
- Short synthesized bounce, rim, whistle, and crowd-accent sounds start only after the player's interaction. Audio is optional and independently mutable. Do not depend on downloaded announcer recordings.

## Controls and control ownership

Keyboard defaults:

| Input | Offense | Defense |
| --- | --- | --- |
| WASD / arrows | Move controlled player | Move controlled player |
| J, hold then release | Shoot; turbo near the rim attempts a dunk | Press to jump/block |
| K | Directional pass | Attempt steal |
| L | Cycle pass-target highlight | Switch to best-positioned defender near the ball |
| Shift, hold | Turbo | Turbo |
| Escape / P | Pause | Pause |

With no explicit receiver selection, passing chooses the teammate best aligned with movement direction, then openness and distance. A visible target highlight previews the receiver before the pass. Explicit target selection persists until a pass, possession change, or the target leaves the floor. Turbo plus pass attempts a lob only when the highlighted receiver is cutting within dunking range; otherwise it remains an ordinary pass.

Control follows a completed pass to its receiver. On a rebound or recovered steal, control moves to the user team's ball handler. On a turnover, select the user defender closest to the new ball handler. While a user shot or pass is in flight, retain control of the releasing player so the user can move for a rebound; the AI controls other teammates. Switching defense uses a short debounce and visible feedback.

Touch provides a movement pad and labeled Shoot/Block, Pass/Steal, Target/Switch, and Turbo buttons with equivalent hold behavior. Support simultaneous movement and action pointers, release/cancel handling, and large hit targets. Landscape is recommended; portrait still shows the court, HUD, and usable controls without clipping. Keyboard focus must remain visible in menus, and gameplay keys are captured only while the court has gameplay focus.

Native gamepad support and local/online multiplayer are later milestones. The input layer translates all supported devices into the same gameplay actions.

## Basketball rules and game feel

- Exactly five active players per side, with three reserves. Normal two-point and three-point scoring; determine the shot's value from the release position.
- Four 60-second quarters. The clock runs during live play and stops for dead balls and quarter breaks. A 14-second possession clock resets on changes of possession and rim-contact offensive rebounds.
- A shot released before either clock expires may finish. If it scores, count it once. A period ends after that shot resolves; no live rebound play continues after the period horn. A possession-clock violation produces the opponent's inbound unless a legal shot is still in flight; a missed shot must contact the rim to satisfy the clock.
- Made baskets, out-of-bounds events, and violations enter an inbound state with a brief reset. Inbounds have protected placement, a five-second countdown, and an automatic safe pass if the player does not act. The clock starts when the receiver gains possession.
- Start the first quarter with a short opening jump ball resolved from timing and jump ratings. Alternate opening possession in subsequent quarters. Teams switch baskets at halftime, with spacing and inputs interpreted consistently in the new attack direction.
- Tied games use repeated 30-second overtimes, alternating opening possession, until a period ends with a winner.
- Keep play flowing: no personal fouls, free throws, injuries, or foul-outs in this arcade ruleset. Enforce boundaries and the possession clock; omit backcourt and three-second violations. Contact slows or separates players, with capped strength effects and no permanent pinning.
- Jump shots use a visible hold-and-release meter. Timing, the relevant shooting rating, distance, nearby defenders, and fatigue determine a bounded make chance. A good release improves the chance; it does not guarantee every shot. Resolve seeded shot accuracy at release and render a consistent trajectory; a later legal block can override the shot before the basket.
- Dunks require proximity, a viable approach, turbo energy, and enough separation. A defender can contest or block before the finish. Failed dunk attempts produce a loose ball or missed shot instead of always scoring.
- Passes travel through space and can be intercepted. Steals and blocks require proximity and correct timing, have cooldowns, and expose the defender after a missed attempt. Repeated button presses do not create repeated instant checks.
- Misses produce a visible loose ball. Rebounds depend on location, jump timing, reach, and ratings. No player acquires possession through an opponent or across the court.

All constants and formulas live in an arcade tuning module. The implementation plan must specify their initial values and bounds, including action cooldowns, shot timings, movement speeds, stamina rates, contact radii, and outcome probabilities. They do not modify the existing season simulation formulas.

## Pokémon ratings, turbo, and hot streaks

Read existing attributes and profiles as inputs. Speed affects acceleration and top speed; handling affects ball protection; passing affects pass speed and accuracy; finishing and vertical affect rim attempts; strength affects contact; shooting attributes affect their shot zones; defense, steals, blocks, and rebounding affect their corresponding actions. Cap physical advantages so every species fits the court and opponents remain playable.

Each player has an energy meter. Turbo drains it; ordinary movement allows slower recovery and bench rest faster recovery. Stamina affects drain and recovery. Fatigue modestly reduces acceleration and shot consistency without making controls unresponsive. CPU players obey the same resource rules.

Three consecutive team baskets activate a ten-second team hot streak, measured in live game time. Opponent scoring clears the scoring streak and any active boost; the boost also expires on its timer. While active, give a modest shooting bonus and reduced turbo drain, plus an aura based on each Pokémon's primary type. Hot-streak baskets do not extend the timer. At expiry, reset the streak counter. Quarter changes clear streaks and effects. This is basketball-themed flair; species-specific combat moves are a future feature.

## Teammate and opponent AI

Useful teammates are a first-release requirement. All nine non-user-controlled players make spatial decisions; the CPU uses the same movement, ball, timing, collision, and stamina rules as the user team.

- **Half-court offense:** assign five distinct floor roles for ball handler, wings, corner/spacing outlet, and interior screener/finisher. Maintain separation; move a covered receiver to an open nearby spot. One player may cut while another fills the vacated space.
- **Screens:** a nearby interior teammate periodically sets a short, stationary screen away from the ball handler's path, then rolls toward the basket. Prevent multiple simultaneous screeners and permanent body walls.
- **Transition:** send wide runners, an outlet, and a trailing big toward the attacking end. Keep a safety player able to recover on a turnover.
- **CPU ball handler:** choose drives, passes, jump shots, and rim attempts from openness, ratings, distance, and remaining clock. Include bounded reaction delay and aim variation. Avoid both instant perfect reactions and standing until the shot clock expires.
- **Defense:** begin with man-to-man assignments; contain the ball, protect the rim when beaten, close out on catches, and recover to assignments. Reassign on substitutions and changes of possession. AI teammates still defend while the user controls another defender.
- **Loose balls:** select nearby rebounders and recovery players, leaving other players available for outlets and transition defense. Separate overlapping players and detect stuck movement.

The initial exhibition uses a consistent balanced offensive system and man-to-man defensive system. Existing season tactic and defense selectors remain season settings; they are not presented as functioning arcade controls until spatial support is implemented. Arcade menus describe the rules actually in use.

## Bench and substitutions

The pause and quarter-break menus show all eight players with energy and basic fit. Select a reserve and active player to queue a swap. Validate that each player appears once and five players remain active. Apply all queued changes atomically at the next dead ball, or immediately during an existing quarter break, before the next inbound. Never substitute an airborne shooter or current ball handler during live play.

Show queued substitutions until applied and allow cancellation. The CPU makes its own energy- and fit-based substitutions at dead balls. User substitutions do not edit the saved draft's original positions. Quarter breaks grant partial energy recovery, not a complete reset.

## Architecture and state boundaries

The current application is React/TypeScript/Vite. Its match engine simulates possession events and has no continuous positions or human input. Add a separate spatial arcade engine while sharing factual Pokémon data and read-only rating/profile functions.

Proposed boundaries:

- `src/game/arcade/types.ts`: immutable setup, world state, player/ball state, input actions, phases, and events.
- `src/game/arcade/setup.ts`: validate both eight-player rosters, copy data, build profiles, and initialize five active roles per side.
- `src/game/arcade/tuning.ts`: named gameplay constants, bounds, and arcade-specific rating mappings.
- `src/game/arcade/engine.ts`: fixed-step orchestration and transitions among ready, live, inbound, quarter break, and final states. Pause is a wrapper state that preserves the underlying phase.
- Focused movement, ball/action, AI, and scoring/stat modules beside the engine. Engine state owns positions, energy, action cooldowns, seeded randomness, active players, and clocks.
- `src/arcade/renderer.ts` and supporting drawing/animation modules: Canvas 2D world rendering and effects, reading state without deciding gameplay outcomes.
- `src/arcade/input.ts`: keyboard/touch normalization, held actions, edge-triggered actions, focus, and cancellation.
- `src/hooks/useArcade.ts`: animation-loop lifetime, simulation accumulator, input dispatch, state-to-HUD snapshots, and teardown.
- `src/components/ArcadeSetup.tsx`, `ArcadeGame.tsx`, `ArcadePause.tsx`, and `ArcadeResults.tsx`: accessible React menus, scoreboard, controls, and recap.
- `src/arcade.css`: responsive game shell, HUD, menus, and touch controls.
- A small `src/App.tsx` integration introduces the arcade entry point and switches views while retaining the existing `useGame` instance.

Use a 60 Hz simulation step with requestAnimationFrame rendering. Limit catch-up work after stalls; pause on hidden tabs or loss of focus instead of jumping the game clock forward. On pause, clear held inputs and cancel any unreleased shot charge while preserving ball position, airborne actions, and cooldown progress at the same simulation instant. On resume, discard elapsed wall time and require fresh input edges. A pause must never release a shot automatically or leave a player stuck charging one.

Canvas handles moving actors; React updates menus and HUD from throttled snapshots rather than rerendering the entire app per frame. Use logical court coordinates independent of pixel size, device-pixel-ratio-aware rendering, and a single projection for court, players, ball, and pointer controls. Resize preserves world state. Manage one loop per game and clean up listeners, animation frames, pointer captures, and audio on exit.

Use a new exhibition seed and an arcade model version. Reproducibility means identical setup, fixed-step inputs, and seed produce identical state/events. It does not require results to match the statistical season engine.

## Results, persistence, and failure handling

Record scoring, attempts, assists, turnovers, steals, blocks, rebounds, and playing time through one event stream. Build the HUD and both box scores from that stream. Track two- versus three-point attempts and offensive versus defensive rebounds. A basket, possession change, rebound, or turnover is credited once even when several events occur in one simulation step.

For assists, credit the final passer when a made shot is released within three live seconds of a completed pass, provided there was no intervening turnover, second pass, or offensive rebound. Credit an interception as a passer turnover and interceptor steal; credit a successful strip as a ball-handler turnover and defender steal. Out-of-bounds and possession violations record team turnovers if no individual action caused them. Each missed field goal can have at most one rebound, and only when live play continues and someone secures the ball.

Player of the game uses points + 1.5 × assists + 1.2 × total rebounds + 2 × steals + 2 × blocks − turnovers − 0.5 × missed field goals, across both teams. Break ties by points, then assists, then lower Pokémon ID. The results screen visibly identifies the game as an exhibition. Playing time includes overtime and sums to five times each team's elapsed game-clock time. Flight resolution after a period horn does not add playing time.

Keep existing save formats, all season model inputs, saved seasons, playoff state, and season records intact. The inspected baseline uses `pokemon-basketball:v3`; preserve any newer format introduced by concurrent work as well. Arcade events do not write to league standings, playoff brackets, or completed fixtures. Store only optional audio/effects settings under a separate versioned arcade key; malformed or unavailable storage falls back to defaults without blocking play. Match progress and exhibition records are session-local for this milestone.

Preload game assets before enabling tipoff. If an individual sprite fails, use a labeled fallback actor with the same team and control markers. If setup validation fails, show an actionable error and return to setup. Rendering failures stop the loop and offer a route back to the roster. No external API, account, database, or new runtime dependency is necessary for this design.

## Acceptance and validation

Completion requires a human-controllable game, not a visual replay of simulated outcomes.

- Finish a match using movement, passes, shots, and defense; reach a consistent final score and both box scores. Verify overtime, rematch, opponent selection, and return to the original roster.
- Confirm all ten active players participate, teammates maintain useful spacing, a screen-and-roll and a cut can create a passing opportunity, and CPU possessions end in plausible shots or turnovers.
- Verify real ball travel, catches, interceptions, blocks, missed shots, rebounds, boundary events, possession-clock violations, buzzer shots, and halftime basket switching.
- Verify substitutions and CPU substitutions preserve exactly five unique active players per side. Score/stat arithmetic and live playing-time totals must reconcile.
- Test fixed-step determinism, input edge/cooldown behavior, single ownership of the ball, no duplicate scoring, hot-streak expiry, and energy recovery. Use scenario tests for gameplay invariants rather than tests mirroring draw calls.
- Exercise keyboard and multi-touch controls, simultaneous movement/actions, pause/resume, hidden-tab suspension, resizing, pointer cancellation, focus handling, and cleanup after repeated entry/exit.
- Inspect desktop, landscape mobile, and portrait mobile layouts with screenshots. Confirm visible player/control markers, readable HUD, useful touch targets, reduced-motion effects, and optional audio.
- Confirm an existing completed league and saved draft are unchanged after opening, finishing, and abandoning exhibitions. Check legacy/incomplete-roster gating and blocked setup during simulation/restoration.
- Run relevant existing regression tests, TypeScript checking, production build, and real-browser playthroughs. Measure frame pacing with ten actors on the test environment; report observed performance and any device coverage limits.

## Later milestones

After the exhibition feels good: broader spatial coaching schemes, gamepad/local multiplayer, gym challenge progression, individually animated species, signature abilities, and playing scheduled league fixtures. Season integration needs its own results/versioning design; online multiplayer needs a separate synchronization architecture.

The next artifact after user review is an implementation plan that orders the spatial engine, input/render loop, AI, match rules, UI integration, and validation into reviewable steps.
