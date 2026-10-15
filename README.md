# 82–0 Pokémon Basketball

Draft five Pokémon into PG, SG, SF, PF, and C, then simulate an 82-game basketball season. Includes the original 151 Pokémon, position-specific ratings, Spin & Pick and Free Draft, an MVP recap, and browser-local records.

## Run

Requires Node 24 or newer and npm. From the repository root:

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

This cloud environment already contains Node 24 and Chromium. Use the existing checkout at `/workspace/pokemon-basketball`; each cloud task is isolated, so a separate Git worktree is unnecessary unless requested. Services must be restarted in a new task; installed dependencies and checked-in assets are retained.

## Play

- **Spin & Pick:** each pick offers four Pokémon. Choose one, then place it on the court. Each placement is locked. You have two re-rolls for the entire draft.
- **Free Draft:** search or filter the pool, replace players, and select two occupied court positions to swap them.
- Pokémon can appear only once in a lineup. Legendary/mythical Pokémon can be excluded with the toggle. Mode/pool changes start a new run, with confirmation if players are already placed.
- Once all five positions are filled, simulate the season. Results reveal gradually; use **Skip reveal** to see everything immediately. Reduced-motion settings skip the animation automatically.
- One season per lineup. Refreshing restores the same completed results. **New run** starts another draft while preserving separate personal records for each mode.
- Ratings, normalization, and game odds are explained in the expandable playbook. Types identify Pokémon; battle effectiveness and special move abilities are outside this version.

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
- `public/pokemon/`: 151 locally served portraits, plus their source URLs and SHA-256 manifest.
- `tests/e2e/`: real-browser workflow checks.

The season engine samples winners from lineup/opponent ratings and generates corresponding scores; it is not a possession-level basketball simulation. Every schedule has 41 home and 41 away games. The original 151, five starters, and regular season are the initial scope; benches, playoffs, additional generations, and public hosting are not included.

## Data and artwork

See [data sources](src/data/SOURCES.md). Refresh factual data with `npm run data:import` and artwork with `python scripts/download-artwork.py` (Python 3 and curl required). These are maintainer commands, not startup requirements. They use verified HTTPS requests to PokeAPI's public GitHub repositories. The application does not copy the reference site's implementation.

Inspired by [17–0 Pokémon Football](https://poke17-0.com/). Unofficial fan project; Pokémon and character artwork belong to Nintendo, Game Freak, The Pokémon Company, and their respective owners.
