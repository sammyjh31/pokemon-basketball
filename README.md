# 82–0 Pokémon Basketball

Build an eight-player Pokémon rotation — five starters and three reserves — then chase an undefeated 82-game season. An [All-22](https://all22pokemon.com/)-inspired lineup builder and draft challenge with 251 Pokémon from Gen I–II, 20 basketball skills plus advanced player traits, a complete 30-team league, league awards, and browser-local records.

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
- One season per lineup. Refreshing restores the same completed results. **New run** starts another draft while preserving separate personal records for each mode.
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
- `public/pokemon/`: 251 locally served portraits, plus their source URLs and SHA-256 manifest.
- `public/pokemon-pixel/`: the matching 251 Gen V pixel sprites and provenance manifest.
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
- **Awards:** League MVP, Defensive Player of the Year, Sixth Player of the Year, and scoring/assist/rebound champions. Each includes three finalists across the entire league. All-League and All-Defense select five players each. Your team's eight-player season table remains available separately.

See [the league model](docs/LEAGUE_MODEL.md) for schedule construction, exact award formulas, leader qualifications and versioning rules. All player species are unique across the league, including when legendaries are disabled.

Saves use `pokemon-basketball:v3`. Valid v1/v2 saves migrate without deleting their original keys. Completed earlier seasons retain their results and records; start a new run for a full league season. Frozen `legacy*` and `v2*` modules preserve old outcomes. Future simulation changes require explicit model migration.

Playoffs, careers, injuries, generations beyond II, multiplayer accounts and public hosting are not included.

## Data and artwork

See [data sources](src/data/SOURCES.md). Refresh factual data with `npm run data:import`, artwork with `python3 scripts/download-artwork.py`, and pixel sprites with `python3 scripts/download-pixels.py` (Python 3 and curl required). These are maintainer commands, not startup requirements. They use verified HTTPS requests to PokeAPI's public GitHub repositories. The application does not copy the reference site's implementation.

Visual direction inspired by [Pokémon All-22](https://all22pokemon.com/); original challenge concept inspired by [17–0 Pokémon Football](https://poke17-0.com/). Unofficial fan project; Pokémon and character artwork belong to Nintendo, Game Freak, The Pokémon Company, and their respective owners.
