# 82–0 Pokémon Basketball

Build an eight-player Pokémon rotation — five starters and three reserves — then chase an undefeated 82-game season. An [All-22](https://all22pokemon.com/)-inspired lineup builder and draft challenge with an initial 251 Pokémon from Gen I–II, 20 basketball skills plus advanced player traits, a complete 30-team league, league awards, multi-season franchises, and browser-local records. Franchise rookie drafts introduce 774 additional species from Generations III–IX.

## Run

Requires Node 24.15 or newer and npm; `.nvmrc` pins the tested Node 24.19.0. From the repository root:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open [the local game](http://127.0.0.1:5173/). In a cloud workspace, bind the server to `0.0.0.0` instead and use the environment's forwarded preview URL. Restart the server when entering a new environment.

## Play

- **82–0 Challenge (Spin & Pick):** each pick offers four Pokémon. Choose one, then place it on the court. Each placement is locked. You have two re-rolls for the entire draft.
- **Lineup builder (Free Draft):** search by name or Pokédex number, filter by type, replace players, and select two occupied court positions to swap them. Randomize creates eight unique players; Clear all empties the roster. Auto-fill bench fills only empty reserve slots. Sort the pool by position fit, three-point shooting, rebounding, or stamina.
- Switch between pixel sprites and official artwork. Both styles and the fonts are served locally.
- **Copy link** shares all eight roster slots (older five-player links still load). If clipboard access is unavailable, a selectable URL is shown. A shared link opens the builder and asks before replacing existing progress. Coaching choices, records, seeds, and season results are not included in the URL. A localhost link is only reachable on the same computer; use a hosted preview's URL when sharing with someone else.
- **Save image** downloads a PNG of the court, bench, and coaching panel. Browser download permission may be required.
- Pokémon can appear only once in a lineup. Legendary/mythical Pokémon can be excluded with the toggle. Mode/pool changes start a new run, with confirmation if players are already placed.
- Once all eight slots are filled, simulate the season. Results reveal gradually; use **Skip reveal** to see everything immediately. Reduced-motion settings skip the animation automatically.
- Refreshing restores your saved progress. After the Finals, **Continue as franchise** keeps all 30 rosters for multiple seasons, with offseason trades, career stats and championship history. **New run** starts a fresh draft; ending an active franchise explicitly replaces its career history while preserving separate challenge records.
- Ratings, normalization, and simulation rules are explained in the expandable playbook. Types identify Pokémon; battle effectiveness and special move abilities are outside this version.

All game data and portraits are bundled locally. Gameplay needs no external API, accounts, database, or secrets. LocalStorage keeps a versioned save in the current browser; clearing site data clears progress. If saving is unavailable, play continues in memory with a notice. This is not a multiplayer leaderboard or an anti-cheat system.

## Validate

```sh
npm test -- --run
npm run typecheck
npm run build
npm run test:e2e
```

Playwright uses `/usr/bin/chromium` when available, or the `CHROMIUM_PATH` override. On other machines, install Playwright's browser with `npx playwright install chromium`; the configuration falls back to that browser when no system Chromium exists. Browser checks cover desktop and mobile drafts, complete seasons, refreshing, keyboard input, modal focus, locally served artwork, and readable text contrast. Failure traces and screenshots go into ignored `test-results/`.

## Structure

- `src/game/`: deterministic draft/simulation rules, rating formulas, state reducer, and save validation.
- `src/components/`: court, draft cards, season schedule, rules, and confirmation dialog.
- `src/data/`: bundled factual Pokémon records and original fictional opponents.
- `public/pokemon/`: locally served portraits for all 1,025 bundled species, with separate original and rookie provenance manifests.
- `public/pokemon-pixel/`: matching local pixel sprites, using the preserved Gen V collection for the initial pool and PokeAPI's default collection for rookies.
- `tests/e2e/`: real-browser workflow checks.
- `design-qa.md` and `docs/design/`: reference comparisons and desktop/mobile evidence.
- `docs/LOCAL_HANDOFF.md`: current implementation and validation notes for local/cloud continuation.

## Keep local and cloud in sync

GitHub's `main` branch at [sammyjh31/pokemon-basketball](https://github.com/sammyjh31/pokemon-basketball) is the shared source. Start each session with a clean working tree and `git pull --ff-only origin main`. Commit and push validated changes before switching environments. Never force-push to resolve concurrent local/cloud work; fetch and reconcile it instead.

Local checkout: `/Users/sam/Documents/PokeBBall`. Existing cloud checkout: `/workspace/pokemon-basketball`. Run `npm ci` after dependency changes. Browser saves stay in the current browser, so use Copy link to carry a lineup between environments.

## Scouting, coaching, and league statistics

- **Scouting:** 20 basketball skills derive from six Pokémon base stats, height, weight and averaged type tendencies. Advanced profiles add screening, off-ball movement, post play, switchability, discipline, usage, foul drawing, closeouts and decision-making. Reports explain archetypes, strengths, tradeoffs and five positional fits.
- **Coaching:** five offensive identities, three rotation emphases and four defensive schemes (man, switching, zone and press). Actual five-player lineups change through substitutions, fatigue, foul trouble and late-game decisions. Projected minutes are a plan, not a guarantee.
- **A complete league:** your eight picks are reserved first. The other 29 teams draft unique eight-player rosters from the remaining species. Every team plays 82 games, 41 at home, in one shared 1,230-game schedule.
- **Match engine:** both teams generate possession events through transition, pick-and-roll, isolation, post and spot-up plays. Matchups, passing, screens, spacing, shot zones, shooting fouls, and-ones, offensive boards and fatigue affect outcomes. Tied games play overtime. Scores, player statistics and standings all come from the same events.
- **League center:** sortable standings, every team's roster and coaching identity, searchable player leaders, per-game/totals views, percentage qualifications, per-36 production, TS%, AST/TOV and two-player comparisons. Every game has a replayable box score for both teams, period scores, shot zones, fouls, plus/minus and play-type counts.
- **Defensive stats:** switch between **All stats** and **Defense** in league or playoff player leaders, the franchise **Career stats** tab, and individual career pages. Defense shows defensive rebounds, steals, blocks, combined steals plus blocks (STL+BLK), fouls and per-36 rates. Select column headers to sort leader tables and the **Career stats** table. **Per game** and **Totals** change counting stats; per-36 rates stay unchanged and show a dash when no minutes were played. Regular-season and playoff statistics stay separate. Game box scores show OREB and DREB alongside total rebounds for each player and team.
- **Awards:** League MVP, Defensive Player of the Year, Sixth Player of the Year, and scoring/assist/rebound champions. Each includes three finalists across the entire league. All-League and All-Defense select five players each. Your team's eight-player season table remains available separately.
- **Playoffs:** the top 16 teams enter a fixed bracket of best-of-seven series, with 2–2–1–1–1 home court for the higher seed. Advance a slate, a round, or the whole postseason. Follow all series, playoff-only player leaders and every game box score through the championship and Finals MVP.

See [the league model](docs/LEAGUE_MODEL.md) for schedule construction, exact award formulas, leader qualifications and versioning rules. All player species are unique across the league, including when legendaries are disabled.

Saves use `pokemon-basketball:v3`. Valid v1/v2 saves migrate without deleting their original keys. Completed earlier seasons retain their results and records; start a new run for a full league season. Frozen `legacy*` and `v2*` modules preserve old outcomes. Future simulation changes require explicit model migration.

Existing model-3 league seasons can begin playoffs without repeating the regular season. Playoff progress saves independently, and regular-season awards and 82–0 challenge records stay unchanged. Finals MVP uses Finals-only production from the champion's roster.

## Franchise mode

After completing the Finals, choose **Continue as franchise**. The completed season becomes Year 1. Your eight-player team and all 29 opposing rosters persist into each new season.

- **Development:** each offseason changes real basketball skills across all 240 players, using minutes, per-minute performance, skill-specific production and frequent breakout/slump surprises. Individual skills can move −10 to +12 in a year. The **Development report** explains every change and can be filtered by year, team, player or rating direction. Existing offseason saves show **Run offseason development** once.
- **CPU trades:** other clubs negotiate up to six exchanges per offseason, with at most one per club. They evaluate ability, positional coverage, coaching, roster weaknesses, development and their recent season. Your roster is excluded from automatic deals. The report lists both packages and the reasoning. Trained skills and careers follow the player.
- **Trade market:** search the 232 players on opposing clubs by name, club, position and availability. Available, Listening and Core player labels communicate asking price. Offer equal packages of one, two or three players to one club. Preview the club's basketball priorities, then execute an accepted deal. **Find deals** searches a limited set of packages for your selected target or outgoing players; it shows accepted offers to review, and each offer is evaluated again before execution. An empty search does not prove that every possible deal fails. Trades preserve eight players per club and unique species; the activity log records every player involved.
- **Offseason roster:** move any of your eight players between starters and reserves, set offense, defense and rotation, and assign 240 minutes with five positive-minute closers. Changes save to your next-season roster. Trades and rookie replacements inherit the destination slot's minutes. Training plans stay with retained players; departing players' plans are removed. The completed season and historical games keep their frozen lineups.
- **Rookie draft:** after development, draft two rounds of 30 picks. The worst prior-season record picks first in both rounds, breaking ties by lower point differential and then club ID. Your first rookie draft introduces Generation III, followed by IV through IX, regardless of how old an existing franchise is when it begins drafting. Later drafts use remaining eligible, never-rostered and never-drafted prospects from the bundled later generations. Search and scout the class, choose the rookie and player to release, or draft the shown coaching recommendation. Each pick immediately replaces one owned player. CPU picks advance to your next turn, and the board records every rookie and release. Trading pauses during an incomplete draft. If no eligible prospects remain, the remaining picks are visibly skipped; no new species or generations are invented.
- **Playable seasons:** use **Play next game**, **Simulate next game**, or **Simulate remaining season**. Each regular-season action advances a full 15-game league round. Qualified teams can **Play next playoff game** through the Finals. Four 60-second quarters produce an official 48-minute box: scores/counting stats ×12, with appearances and honors counted once. Official overtime is 25 seconds. Leaving an unfinished game keeps the fixture pending; completed results record once.
- **Rotation editor:** in the offseason or before Game 1, assign 0–48 minutes to each of the eight players, totaling 240, and choose five positive-minute closers. Roster slots set the starting lineup; zero-minute starters are replaced for simulations. Targets influence substitutions, with fouls/overtime able to change actual minutes. In games you play, use the pause menu to substitute manually. Coaching/lineup inputs lock after the first completed game.
- **Individual training:** set each player's focus (balanced, shooting, defense, playmaking, conditioning, or a position) and steady/standard/aggressive intensity. Focus trades general development for selected skills; intensity changes volatility. Plans apply at the next unprocessed offseason and never reroll completed reports.
- **Free agency:** after finishing the rookie draft, open **Offseason → Free agents**. Search released Pokémon, compare their developed ratings and scout their careers, then choose one of your eight players to release. Every signing replaces that player in the same slot and minutes; the released Pokémon joins the market. Unsigned players carry into future offseasons. **Run CPU free agency** lets other clubs make up to one fit-based upgrade each, weakest record first, while protecting their current rookies. This round runs automatically before the next season if you skip the button. The activity log records signings and releases by year, and you can still sign players after the CPU round.
- **Next season:** finish the rookie draft, then start a new year with your offseason roster and coaching choices. Any pending CPU free-agent round completes first. You can still adjust positions and coaching before tipoff. A fresh seed generates another 82-game season and best-of-seven playoffs. Franchise years do not inflate challenge attempt counters.
- **Careers:** league-wide regular-season and playoff totals follow Pokémon across trades and remain available after a player is released in a rookie draft. Open a **Career page** for season-by-season teams and production, shooting percentages, skills, development trajectory, awards and championship rings. Live season production contributes immediately; DNPs do not count as appearances.
- **History:** open **View Year N games** for any newly archived season. Filter by club and regular season/playoffs, then open both-team box scores. Historical games use frozen rosters, ratings, rotations and played results. Older years whose original saves discarded detailed stats are clearly marked unavailable; their existing career totals and honors remain.
- **Saving:** the existing v3 browser key supports franchise model 3, interactive season model 6 and played playoff model 2. Prior model paths retain their original outcomes. Completed game prefixes and frozen archives validate against simulation inputs and stored official results. Save failures remain visible with **Retry saving**; play can continue in memory. Saves stay in this browser and are not synchronized through GitHub.

Injuries, aging, contracts, free agency, generations beyond IX, multiplayer accounts and public hosting are not included.

## Local league with friends

Choose **Local league** in the top navigation to run a snake draft together on one computer. Add 2–30 friends, give each a name and a different team, and choose whether legendary/mythical Pokémon are available. The CPU manages all remaining teams.

New local drafts include **Generations I–VII: 809 species**, with **739 eligible without legendaries/mythicals**. Filter the draft pool by generation. Existing local drafts and solo modes keep their original Generations I–II pool; use **New local league** when ready for the expanded pool.

All 30 teams draft eight players from one shared pool. The order is randomized once and reverses each round. CPU picks happen automatically until the next friend's turn. Select an available Pokémon, choose an empty position, then **Confirm pick**; no Pokémon can appear on two teams.

After the draft, use **Review friend** to rearrange each person's starters and reserves and choose offense, defense and rotation. **Simulate local season** runs the existing 82-game schedule for all teams. The friends leaderboard compares records and point differential, while the league center includes every team's roster, player statistics, awards and game box scores.

The top 16 teams then enter the existing four-round, best-of-seven **Playoffs**. Each friend has a qualification/elimination status card, and friends' teams are highlighted in the bracket. Use **Play next slate**, **Finish round**, or **Finish playoffs** to find the champion and Finals MVP. The champion card names the winning friend or identifies a CPU-managed winner. Everyone can follow the tournament even if their team misses the playoffs or is eliminated.

Drafts save under `pokemon-basketball:local-league:v1`, separately from the solo/franchise save. Refreshing resumes the draft; completed seasons and playoff progress reconstruct from their saved rosters, coaching, seed and playoff game count. Existing local seasons can start playoffs without redrafting. Future simulation changes must version this replay contract. **Back to game** preserves both saves; **New local league** asks before replacing only the local league. This is pass-and-play on one browser, without accounts or network multiplayer.

### Understanding results and probabilities

Open **Matchup explorer** in a new local league to select a shooter, defender, shot location, play type, coverage, position, energy and teammate spacing. Its displayed probability comes from the same shot formula used by the new simulator. The controlled scenario excludes blocks/shooting fouls and assumes neutral court, a fresh defender, average help defense, and no passing/screening advantage. Actual games supply their live lineup context.

Local save version 2 uses a bounded logistic shot model with skill, contest, help, spacing, passing, screens, size/strength/speed matchups, closeouts, coverage, transition, nonlinear fatigue, positional fit and clutch/home effects. Size benefits saturate; no species gets automatic baskets. Types affect underlying basketball skills, not elemental damage multipliers. These are initial game-design coefficients, not a fit to real basketball results. Version-1 local saves and solo seasons keep their existing simulator and deterministic replays.

**Team analysis** in the league center compares estimated points per 100 possessions, eFG%, TS%, turnover rate, free-throw rate, shot mix, offensive rebounds and reserve scoring. Its guide defines each denominator and separates estimates from measured totals. Game boxes include both teams' efficiency factors and actual opposing rebound opportunities. New-model games also compare actual and expected field-goal points on non-foul attempts, excluding free throws and shooting-foul attempts. Descriptive metrics and finishing variance are evidence to investigate, not proof of causation.

## Data and artwork

See [data sources](src/data/SOURCES.md). Refresh factual data with `npm run data:import`, artwork with `python3 scripts/download-artwork.py`, and pixel sprites with `python3 scripts/download-pixels.py` (Python 3 and curl required). These are maintainer commands, not startup requirements. They use verified HTTPS requests to PokeAPI's public GitHub repositories. The application does not copy the reference site's implementation.

The initial 251-species catalog stays separate from the rookie catalog so old season replays retain their original inputs. Reproduce the Generation III–IX import and both image styles with `python3 scripts/import-rookies.py --assets`. Rookie facts and images use pinned upstream commits and SHA-256 provenance manifests; this command does not modify the original facts or original asset manifests.

Visual direction inspired by [Pokémon All-22](https://all22pokemon.com/); original challenge concept inspired by [17–0 Pokémon Football](https://poke17-0.com/). Unofficial fan project; Pokémon and character artwork belong to Nintendo, Game Freak, The Pokémon Company, and their respective owners.

## Five-on-five arcade exhibition

Complete all eight roster slots, then select **Play arcade**. Choose a CPU opponent and **Tip off**. Your five starters take the floor with three reserves available from the pause menu. Franchise exhibitions use current traded rosters and developed skills, including during the offseason. Exhibitions have four one-minute quarters, a 14-second shot clock, and 30-second overtimes. Results include both teams' box scores and player of the game.

- **WASD / arrow keys:** move. **J:** hold and release to shoot; jump/block on defense.
- **K:** pass toward movement or the highlighted receiver; steal on defense.
- **L:** choose a receiver; switch defenders on defense.
- **Shift:** turbo. Turbo + shoot near the rim attempts a dunk; turbo + pass to a teammate cutting near the rim attempts an alley-oop.
- **Escape / P:** pause, review controls, and queue bench substitutions for the next stoppage. Touch devices have a movement pad and action buttons; landscape gives more court space.
- Three unanswered baskets ignite a ten-second elemental hot streak. Energy affects turbo and shooting; reserves recover while resting.

Arcade uses a separate spatial game engine with live movement, passing lanes, shot timing, AI spacing/cuts/screens, and man-to-man defense. Season coaching choices remain season settings. Exhibitions do not change your saved roster, regular-season results, or playoff bracket. Match progress ends on exit or refresh; audio/effects preferences are stored separately. Focus loss pauses play. Audio is optional, and reduced effects respect system reduced-motion preferences.

The initial mode is single-player versus CPU with procedural pixel-sprite animation. Xbox-style gamepads are supported; see [controller controls](docs/CONTROLLER.md). Multiplayer and signature combat abilities are future work. Scheduled franchise games use the same arcade controls through the season’s **Play next game** buttons.
