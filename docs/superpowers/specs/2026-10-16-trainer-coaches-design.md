# Drafted trainer coaches and automatic team management

Status: proposed design for user review. No gameplay implementation yet.

## Intended experience

The user drafts Pokémon and a recognizable trainer coach, then lets that coach run the team throughout simulated seasons. The coach handles basketball decisions without requiring manual tactic, defense, rotation or screen-coverage adjustments. Decisions must change actual games, including CPU games and playoffs, and be understandable afterward.

Confirmed selection rules:

- **82–0 Challenge:** choose one of three seeded trainer offers, with each style explained before selection. Pokémon rerolls do not reroll coaches.
- **Local friend drafts:** choose freely from the available coach roster. Human managers choose in the league's established draft order; selected coaches leave the pool.
- **Lineup builder and franchise coach selection:** choose freely from the available coach roster.
- One head coach per team. Coaches stay with their team across seasons and Pokémon trades. This release adds the initial coach draft, not a recurring hiring or firing market. Human managers select before CPU coaches are assigned, so CPU selection cannot consume their initial choices.

New drafts include a coach-selection step before their first simulation. Existing franchises can select a coach before their first game of an unstarted season, or during the offseason for the following season. Completed and partially played seasons retain their frozen rules and history.

## Coach roster and identity

Launch with 32 characters, enough for 30 unique league coaches: Ash, Misty, Brock, May, Dawn, Iris, Serena, Clemont, Gary, Jessie, James, Delia Ketchum (Mom), Professors Oak, Elm, Birch, Rowan, Juniper, Sycamore and Kukui, Lt. Surge, Erika, Koga, Sabrina, Blaine, Giovanni, Whitney, Jasmine, Clair, Lance, Cynthia, Steven and Leon.

Names and roles come from Pokémon; basketball styles are explicitly fictional interpretations. Each coach card explains preferred personnel, offensive approach, defense, rotation habits, adaptability and tradeoffs. There is no universally superior coach or champion stat multiplier. The team must still execute with its players' skills, typing, dimensions, fatigue and available matchups.

Example identities:

- **Brock:** interior offense, paint protection, strong screens and rebounding; slower lineups can struggle against spacing.
- **Misty:** movement, passing and flexible perimeter defense; needs mobile players and competent shooters.
- **Professor Oak:** flexible plans built around roster strengths and observed opponent tendencies; less commitment to an extreme specialist identity.
- **Mom:** deeper rotations and conservative workload/foul management; rests stars more than a win-now coach would.
- **Ash:** transition opportunities, aggressive counters and late-game risk; can spend energy quickly.
- **Sabrina:** deliberate half-court creation and precise matchup targeting; less emphasis on transition pace.

Other coaches use distinct combinations of these dimensions. Descriptions must match their implemented policy, with tradeoffs verified in controlled scenarios.

## What the coach does automatically

Before every simulated game, the coach evaluates the current roster and opponent, including developed skills, shooting, size/reach/mass, movement, stamina and type advantages/resistances. They choose an offensive identity, defensive scheme, starting lineup, rotation targets and closing priorities. These are decisions within the existing basketball engine, not direct bonuses to the scoreboard.

During games, the coach reacts to score, remaining time, energy, foul trouble, opponent lineups and observed shot patterns. Coaches differ in their willingness to adjust, trust the bench, protect tired players and take risks. Screen coverage incorporates both the actual handler/screener matchup and the coach's preferences; bad mismatches can override a preferred coverage. Decisions are bounded and do not allow knowledge of future random outcomes.

The user does not need to edit minutes or tactics for a coached team. Manual coaching controls become a readable coach plan, with an explanation that actual decisions can change by matchup. The user still manages Pokémon acquisition, trades and draft picks. Existing optional individual training plans remain available; this release does not add another mandatory training task, contracts, salaries or a coach progression system.

## Explain decisions

The draft shows searchable coach cards and a clear selected-coach state. The team and franchise views show the head coach and a concise current plan. Local friends can see which coaches are already taken.

Inside a simulated result, show both coaches, their opening plans and important adjustments with reasons and observed evidence. Keep the existing court diagram, action chains and screen-coverage counts. Reports describe actual recorded decisions, including a decision to stay with an approach when relevant; they do not invent a causal explanation from the final score alone.

## Engine, saves and compatibility

Use a versioned coach assignment on `Run` and `LeagueTeam`, plus explicit selection state for new drafts. Absence of an assignment preserves the old simulation. Separate the character catalog, coach policy, selection lifecycle and presentation into small modules.

Integrate with `match.ts`, `matchLineups.ts` and `courtPossession.ts`. The coach's opening plan operates on cloned game configuration; original roster and archive inputs remain immutable. Player roles, minutes, foul exclusions and eight-player membership remain valid. The same implementation powers regular seasons, playoffs, all CPU fixtures and reconstructed box scores. Arcade player controls retain their real-time engine.

**Critical existing limitation:** the old quarter-adjustment path depends on `result.insights`. New coach decisions must instead use independent game accumulators so compact and detailed simulations consume the same randomness and produce identical boxes. Preserve the old path for older rule versions.

Propagate and validate assignments through league construction, franchise transitions, local draft/career snapshots, archive reconstruction and persistence. CPU coaches are seeded and unique within each league. Initial hiring in an existing franchise changes future input only; historical coaches and plans remain reproducible. Reject unknown coach identities/versions, duplicate league assignments, invalid draft choices and forged midseason changes without overwriting the source save.

## Verification and delivery

- Controlled scenarios prove style changes to lineup, minutes, tactics, coverage and adjustments; roster fit and fatigue can override preferences.
- Same seed and inputs reproduce identical results. Compact/full runs match exactly, and inspecting a report cannot change a result.
- Regular/playoff/CPU/local paths all use the coach policy. Score, minute, roster and clock accounting remain conserved.
- New and old saves, partial seasons, archives, coach retention, existing-franchise hiring and local availability round-trip correctly. Prior uncoached fixtures remain byte-identical.
- UI tests cover three-offer challenge selection, unrestricted eligible selection elsewhere, uniqueness, keyboard access and automatic management. Browser inspection covers desktop/mobile and leaves the user's current save intact.
- Run focused regressions, a varied-coach balance audit and production build; obtain an independent review before delivery. Commit incrementally and push to GitHub, retaining the active local preview.

Implementation belongs in the attached basketball checkout `/Users/sam/.codex/worktrees/pokemon-matchup-engine/PokeBBall`. Preserve the primary Grand Table checkout and the separate `claude/court-engine-v2` worktree; reconcile any incoming main changes before pushing.

Character reference examples: [original-series cast](https://www.pokemon.com/uk/animation/seasons/1/episode-36-pikachus-goodbye), [Sinnoh characters](https://diamondpearl.pokemon.com/en-au/story/), [Galar characters](https://swordshield.pokemon.com/en-gb/people-galar-region/), [Delia Ketchum](https://bulbapedia.bulbagarden.net/wiki/Delia_Ketchum). These identify characters; they do not establish basketball abilities.
