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

- **Trainer coaches:** choose one of three seeded trainer offers in the 82–0 Challenge; freely choose an available trainer in the lineup builder, local friend drafts and initial franchise hiring. All 32 trainers have their own styles and tradeoffs. Human friends choose before CPUs fill the remaining jobs. Your coach stays until an offseason appointment and automatically handles starters, minutes, closers, offense, defense, screen coverage and live adjustments. Your trainer also automatically selects individual training; you manage roster moves. Game insights show the actual opening plan and adjustments. Existing played seasons retain their original inputs; hire your first trainer in the offseason or before an unplayed franchise season.
- **First visit:** a **How do you want to play?** chooser offers the 82–0 Challenge, Free build (Lineup builder), Franchise (unlocked after one season) and Local league, each with a one-line goal. The choice is remembered in this browser (`pokemon-basketball:onboarding:v1`, separate from the game save) and **How to play** in the header reopens it. A **Getting started** checklist (draft 8 → simulate → continue) stays near the top until it is complete or hidden.
- **Header:** mode buttons (Lineup builder, 82–0 Challenge, Local league) are grouped apart from page links (**Season**, **Scouting guide**, **How to play**). The scouting guide/playbook opens as a dialog. During an active franchise the challenge/builder tabs are hidden with a short explanation; **End franchise / new draft** is the way out.
- **82–0 Challenge (Spin & Pick):** each pick offers four Pokémon. Choose one, then place it on the court. Each placement is locked. You have two re-rolls for the entire draft.
- **Lineup builder (Free Draft):** search by name or Pokédex number, filter by type, replace players, and select two occupied court positions to swap them. Randomize creates eight unique players; Clear all empties the roster. Auto-fill bench fills only empty reserve slots. Sort the pool by position fit, three-point shooting, rebounding, or stamina.
- Switch between pixel sprites and official artwork. Both styles and the fonts are served locally.
- **Copy link** shares all eight roster slots (older five-player links still load). If clipboard access is unavailable, a selectable URL is shown. A shared link opens the builder and asks before replacing existing progress. Coaching choices, records, seeds, and season results are not included in the URL. A localhost link is only reachable on the same computer; use a hosted preview's URL when sharing with someone else.
- **Save image** downloads a PNG of the court, bench, and coaching panel. Browser download permission may be required.
- Pokémon can appear only once in a lineup. Legendary/mythical Pokémon can be excluded with the toggle. In the Lineup builder the toggle only changes the pool: your other picks stay, and removing legendaries first confirms which players will leave. The 82–0 Challenge deals from one fixed pool, so changing it (or switching modes) restarts the draft after a confirmation that names what will be cleared.
- Once all eight slots are filled, simulate the season. Results reveal gradually; use **Skip reveal** to see everything immediately. Reduced-motion settings skip the animation automatically.
- Refreshing restores your saved progress. After the Finals, **Continue as franchise** keeps all 30 rosters for multiple seasons, with offseason trades, career stats and championship history. **New run** starts a fresh draft; ending an active franchise explicitly replaces its career history while preserving separate challenge records.
- Ratings, normalization, and simulation rules are explained in the **Scouting guide** dialog. New simulated seasons use bounded type advantages and physical matchups in basketball decisions and outcomes; they do not use battle damage or automatic elemental stops.

All game data and portraits are bundled locally. Gameplay needs no external API, accounts, database, or secrets. Progress is saved in the current browser (see [Saving](#saving)); clearing site data clears progress. If saving is unavailable, play continues in memory with a notice. This is not a multiplayer leaderboard or an anti-cheat system.

## Saving

Solo/franchise progress and the local league are saved separately in this browser, after every change. Open **Save options** above the game (or the local league) to manage them.

- **Storage:** small saves stay in `localStorage` under their original keys (`pokemon-basketball:v3`, older `v2`/`v1` saves, and `pokemon-basketball:local-league:v1`), so existing saves load unchanged. A save too large for the browser's shared ~5M-character `localStorage` quota moves to IndexedDB (`pokemon-basketball-saves`), and its `localStorage` key holds an `@indexeddb:` pointer. With coach careers, chemistry, morale and personalities, franchise saves reach about 6.9M characters by year 2 and about 28.5M by year 20; a 50-season, 30-club local career is about 10.8M.
- **Last verified backup:** whenever a save loads and passes full validation (including replaying its seasons), a copy is kept under `<key>:backup`. Saves made during play are not copied until they have been verified on a later load.
- **Damaged saves:** a save that fails validation is moved to `<key>:quarantine` before anything can overwrite it. A notice explains what happened; **Restore last verified backup** replaces the current save with the backup and reloads, **Download set-aside save** keeps a copy of the damaged one, and **Discard it** deletes it.
- **Export / import:** **Export save** downloads the current save as a JSON file. **Import save** accepts an exported file (or a raw save copied from storage), validates it with the same checks as loading, and asks before replacing anything. Solo/franchise and local league saves import only into their own mode.
- **Several tabs:** if another tab changes the same save, this tab stops saving, so it cannot overwrite the newer progress, and offers **Reload to continue**.
- **Faster restore:** saved leagues are re-simulated to validate them on load. This replay runs in a background worker with progress, so the page stays responsive; it falls back to the page when workers are unavailable, with the same result.

## Game flow: playoffs, timeouts, officials, arenas and rest

New games give every simulated fixture its context. The regular season has a calendar: each round spans two days, so teams play some back-to-backs (about 14 a season) and long road trips. Tired players start below full energy, and coaches who prefer rest shift starters' minutes to the bench on the second night.

Playoff games play differently. Rotations tighten, especially in elimination games, though coaches who prefer depth tighten less. The pace slows into more half-court offense, defenses tighten, stars carry more usage, composure matters under pressure and home crowds are louder. A coach who lost the previous game of a series, and is adaptable enough, re-plans from the series' scouting evidence.

Trainer coaches call timeouts to stop opponent runs, rest a tired floor or set up a late-game play with the ball advanced to the frontcourt. Each team has six regulation timeouts, at most three in the fourth quarter, plus two per overtime. A timeout lets both teams rest and substitute immediately, and the calling coach draws up an after-timeout play.

Every game has an officiating crew, from **Let them play** to **Whistle-happy**. Crews scale reach, shooting and offensive foul rates. Under a tight crew, disciplined defenders and foul-drawing scorers matter more. Each arena has a field condition, such as rain for the Cerulean Waves, sun for the Cinnabar Flames or snow for the Mahogany Frost; your club's arena follows its roster's shared type. Matching weather strengthens weather species abilities (Swift Swim, Chlorophyll, Sand Veil and others), and players of a comfortable type tire more slowly. A Drizzle or Drought player on the floor changes the court's condition. These effects never add points directly; they act through energy, minutes, shot selection, foul rates and the existing shot model.

On court rules v2, possessions also gain off-ball and post play. Zone defenses guard areas that shift with the ball, protecting the paint but leaving skip-pass and corner gaps and giving up more offensive rebounds. When help rotates, the player it left cuts to the rim (more often with strong off-ball skill), and the nearest shooter drifts to open space. Post plays go to the best post player, whose seal depth depends on post skill and strength; deep seals draw a double team. Players heat up after four straight makes, or three that include two threes. Hot players take more and longer shots, with no shooting bonus, and cool off after a miss. Players go cold after five straight misses.

Box scores show **Game context**: the stage and series score, elimination status, rest, road trip, crew, arena condition, heat checks and every timeout with its reason. Existing active seasons, archives and played arcade games keep their original rules; existing franchises and local careers with court rules adopt game flow at the next season boundary. Reproduce the balance audit with `node scripts/game-flow-audit.mjs --samples=450`; results are saved to `docs/game-flow-audit.json`.
## Player personalities and captains

New games give every Pokémon a stable basketball personality: ambition, loyalty, resilience, coachability and leadership, plus a readable archetype. Personalities stay with the species across roster moves and seasons. They change minutes expectations, reactions to winning and losing, trade adjustment, compatibility with trainers and automatic training intensity. These are game adaptations, not canonical Pokémon personality claims.

Coaches automatically appoint a captain using leadership, composure, coaching compatibility, experience and earned teammate relationships. Bench players can be captains. Leadership style and confidence shape how each teammate responds: morale target support is capped at ±3, with no self-boost. Captains add up to ±2 active-five cohesion only while on court. Existing fatigue, rotation budgets and permanent development still apply. The shared lineup evaluation includes captain influence in coaching and recruitment decisions.

See **Player morale** in the coaching/roster views for the captain, selection reasons, personality traits and each player’s response. Scouting exposes personalities before recruiting. Historical box scores freeze captain identity and influence; lineup reports show whether the captain was actually playing. Simulated games and playable games use the same model. Existing active seasons keep their original rules; solo and local franchises adopt personalities at the next season boundary.

## Player morale and automatic support

New games track morale for every roster Pokémon. Actual playing time relative to a talent-based role expectation, recent wins and losses, trainer fit and roster changes shape confidence gradually. Coaches automatically balance extra opportunities, newcomer support, encouragement and recovery; they also moderate training intensity for distressed or overworked players. Rotation budgets remain 240 minutes with a 40-minute target cap.

Morale supplies at most ±3 temporary execution skill points and ±4 active-five cohesion points. It does not change permanent ratings, physical dimensions or earned shared minutes. Coaching, lineup plans and shared team evaluation use these effects. **Player morale** in coaching/roster views shows each score, contributing factors and automatic response. Historical box scores include **Morale through this game**, with frozen pregame factors and before/after scores.

Trade packages carry each incoming Pokémon’s current state, apply adaptation stress and mildly unsettle remaining teammates. Rookies begin with neutral confidence and an adjustment period; free-agent signings start a fresh opportunity. Offseasons carry half the distance from neutral, while played games and simulated games use the same update from actual minutes (normalized for overtime). Current previews read the latest regular-season/playoff state. Existing active seasons keep their original engine and replay; existing franchises adopt neutral morale at the next season boundary.

## Team chemistry and ability partnerships

New games evaluate the actual five Pokémon sharing the court. Complementary creators, shooters, finishers and defenders improve coordination; poor balance can reduce it. Named ability partnerships include **Creator + finisher**, **Screen + space**, **Pressure + anchor**, **Rebound + outlet**, **Second wind**, and **Plus / Minus**. Partners affect passing, movement, screen contact/navigation, rebounding, defensive coordination and energy drain in simulated and playable games. Benched players contribute no effects, and each player/effect uses its strongest partnership contribution rather than stacking every eligible partner.

Coaches compare complete five-player units while respecting fatigue, fouls, minutes and closers. Game plans, recruiting and individual training use the same chemistry model. The coaching panel shows a projected five, cohesion, strengths, gaps and named partners. Game and season **Five-player lineups** reports show the actual unit’s combinations alongside minutes and scoring; expand its cohesion entry for details. Cohesion is a basketball-fit score, not a predicted win percentage, and partnership opportunities do not claim points scored or individual ability activations.

**Earned familiarity** grows between the actual five Pokémon sharing the court in simulated and officially played games. It takes many games to develop, has diminishing returns, and contributes a bounded coordination bonus while strengthening existing ability partnerships. Bench time earns nothing. Each game uses its opening familiarity; newly earned minutes help in the next fixture, including the playoffs.

Franchise teammates retain 90% of their effective shared minutes each offseason. Trades preserve established pair connections, including players traded together and former teammates reunited on another club. Rookies and unfamiliar arrivals begin with zero shared history; replacing a roster slot cannot inherit the outgoing player’s relationships. Coaches account for continuity when choosing lineups, game plans, training and roster moves, alongside talent, fit and workload. Expand **Shared court history by pair** to inspect the projected five’s ten relationships; retained minutes measure current familiarity, not lifetime playing time.

Turning abilities off removes ability partnerships while retaining ordinary basketball chemistry and earned familiarity. Existing active seasons and archived games keep their original results; existing solo and local franchises adopt familiarity at the next season boundary with an empty history. Earlier shared minutes are not invented. Historical boxes use each game’s frozen pregame familiarity, and season lineup reports average it by actual court time.

## Physical species abilities

New games extend species abilities beyond shot probability. Levitate improves movement, screen navigation and rebound pursuit; Guts strengthens screens and rebounding; Pickup improves rebound contests; Natural Cure reduces energy drain and accelerates recovery. Conditional abilities such as Overgrow only boost movement when the player is tired. Body size, skills, typing, energy and positioning still determine the underlying matchup.

The same bounded effect profiles drive simulated regular-season/playoff games and playable arcade games. Coaches include these benefits in plans, screen coverage, rotations and individual training. Shared team value also carries that assessment into drafting, trades and free agency.

Ability reports now separate shot activations from **extra feet travelled, affected screen contacts, rebound contests and energy saved**. These are actual recorded effects, not extra shots or guaranteed wins; rebound contests are opportunities, not rebounds won. Playable-game effects are never multiplied by the official scoring scale. New-season scouting explains each physical adaptation.

Existing active seasons and historical replays keep their original behavior. Solo and local franchises adopt the new physical abilities when starting the next season; turning abilities off disables these effects and their coaching value too.

## Shared team evaluation

New games use one team-value assessment for trainer game plans, coaching hires, draft recommendations, CPU picks, trades, free agency, rotations and automatic training. It combines developed basketball talent, positional role, coaching scheme, roster needs, positional depth and enabled species abilities. Size, weight and typing remain part of the underlying basketball skills. Offseason recruiting accounts for newly hired trainers; trade fairness, availability, rival scouting and roster limits still apply.

Expand **How your coach values this roster** to see each player's contributions. Trade, rookie and free-agent assessments explain changes in **shared team value**, separately from universal OVR. Training targets attainable improvements in that same value, with diminishing upside for already strong skills and the existing workload/risk limits. Simulated substitutions and playable-game CPU substitutions use shared role values alongside fatigue and matchup constraints. Existing seasons and historical games retain their original rules; existing franchises adopt the model at their next season boundary.

## Validate

```sh
npm test -- --run
npm run typecheck
npm run build
npm run test:e2e
```

Playwright uses `/usr/bin/chromium` when available, or the `CHROMIUM_PATH` override. On other machines, install Playwright's browser with `npx playwright install chromium`; the configuration falls back to that browser when no system Chromium exists. Browser checks cover desktop and mobile drafts, complete seasons, refreshing, keyboard input, modal focus, locally served artwork, and readable text contrast. Failure traces and screenshots go into ignored `test-results/`. Run `DESIGN_SHOTS=1 npm run test:e2e -- onboarding` to refresh the chooser and offseason-stepper screenshots in `docs/design/`.

## Structure

- `src/game/`: deterministic draft/simulation rules, rating formulas, state reducer, and save validation.
- `src/components/`: court, draft cards, season schedule, rules, onboarding chooser/checklist and dialogs. `lazyPanels.tsx` code-splits the franchise, league, playoff and local-league panels and warms them when the browser is idle.
- `src/data/`: bundled factual Pokémon records and original fictional opponents.
- `public/pokemon/`: locally served portraits for all 1,025 bundled species, with separate original and rookie provenance manifests.
- `public/pokemon-pixel/`: matching local pixel sprites, using the preserved Gen V collection for the initial pool and PokeAPI's default collection for rookies.
- `tests/e2e/`: real-browser workflow checks.
- `design-qa.md` and `docs/design/`: reference comparisons and desktop/mobile evidence.
- `docs/LOCAL_HANDOFF.md`: current implementation and validation notes for local/cloud continuation.

## Keep local and cloud in sync

GitHub's `main` branch at [sammyjh31/pokemon-basketball](https://github.com/sammyjh31/pokemon-basketball) is the shared source. Start each session with a clean working tree and `git pull --ff-only origin main`. Commit and push validated changes before switching environments. Never force-push to resolve concurrent local/cloud work; fetch and reconcile it instead.

Active local basketball checkout: `/Users/sam/.codex/worktrees/pokemon-matchup-engine/PokeBBall` (the primary directory has concurrent project work; see `docs/LOCAL_HANDOFF.md`). Existing cloud checkout: `/workspace/pokemon-basketball`. Run `npm ci` after dependency changes. Browser saves stay in the current browser, so use Copy link to carry a lineup between environments.

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
- **Rival roster planning:** completed seasons preserve each club’s toughest opponents and observed scoring threats. Rookie recommendations and trade negotiations use the last three seasons to improve attacking coverage and defensive resistance, with recent and playoff evidence carrying more weight. Clubs check rivals’ current rosters, value a second counter more than a redundant third, and keep talent and rotation safeguards. Draft advice and trade factors explain the named rivals. This also applies to local career rookie picks and CPU trade decisions; older saves keep their existing history, and new reports come from completed seasons using type tactics.
- **CPU trades:** other clubs negotiate up to six exchanges per offseason, with at most one per club. They evaluate ability, positional coverage, coaching, roster weaknesses, development and their recent season. Your roster is excluded from automatic deals. The report lists both packages and the reasoning. Trained skills and careers follow the player.
- **Trade market:** search the 232 players on opposing clubs by name, club, position and availability. Available, Listening and Core player labels communicate asking price. Offer equal packages of one, two or three players to one club. Preview the club's basketball priorities, then execute an accepted deal. **Find deals** searches a limited set of packages for your selected target or outgoing players; it shows accepted offers to review, and each offer is evaluated again before execution. An empty search does not prove that every possible deal fails. Trades preserve eight players per club and unique species; the activity log records every player involved.
- **Offseason roster:** move any of your eight players between starters and reserves, set offense, defense and rotation, and assign 240 minutes with five positive-minute closers. Changes save to your next-season roster. Trades and rookie replacements inherit the destination slot's minutes. Training plans stay with retained players; departing players' plans are removed. The completed season and historical games keep their frozen lineups.
- **Rookie draft:** after development, draft two rounds of 30 picks. The worst prior-season record picks first in both rounds, breaking ties by lower point differential and then club ID. Your first rookie draft introduces Generation III, followed by IV through IX, regardless of how old an existing franchise is when it begins drafting. Later drafts use remaining eligible, never-rostered and never-drafted prospects from the bundled later generations. Search and scout the class, choose the rookie and player to release, or draft the shown coaching recommendation. Each pick immediately replaces one owned player. CPU picks advance to your next turn, and the board records every rookie and release. Trading pauses during an incomplete draft. If no eligible prospects remain, the remaining picks are visibly skipped; no new species or generations are invented.
- **Playable seasons:** use **Play next game**, **Simulate next game**, or **Simulate remaining season**. Each regular-season action advances a full 15-game league round. Qualified teams can **Play next playoff game** through the Finals. Four 60-second quarters produce an official 48-minute box: scores/counting stats ×12, with appearances and honors counted once. Official overtime is 25 seconds. Leaving an unfinished game keeps the fixture pending; completed results record once.
- **Rotation editor:** in the offseason or before Game 1, assign 0–48 minutes to each of the eight players, totaling 240, and choose five positive-minute closers. Roster slots set the starting lineup; zero-minute starters are replaced for simulations. Targets influence substitutions, with fouls/overtime able to change actual minutes. In games you play, use the pause menu to substitute manually. Coaching/lineup inputs lock after the first completed game.
- **Individual training:** coached teams automatically assign a focus and intensity to all eight players. Trainer style, developed strengths and weaknesses, role fit and roster shortages shape the focus; risk/rest preferences, stamina and season minutes shape intensity. CPU and local friend clubs use the same policy. Preview each plan and its reasons in Training plans (or local team review). Camp resolves at offseason entry with the completed season’s coach, before coaching changes. A new hire directs the next camp. Development reports preserve actual coach assignments across reloads; old reports remain unchanged. Focus redirects a limited practice budget and intensity changes volatility, so improvement is never guaranteed. Legacy uncoached teams retain manual focus and intensity controls.
- **Free agency:** after finishing the rookie draft, open **Offseason → Free agents**. Search released Pokémon, compare their developed ratings and scout their careers, then choose one of your eight players to release. Every signing replaces that player in the same slot and minutes; the released Pokémon joins the market. Unsigned players carry into future offseasons. **Run CPU free agency** lets other clubs make up to one fit-based upgrade each, weakest record first, while protecting their current rookies. This round runs automatically before the next season if you skip the button. The activity log records signings and releases by year, and you can still sign players after the CPU round.
- **Coaching office:** open **Franchise → Coaches** to fire your trainer or hire an available one in the offseason. Hiring can replace the current coach directly; employed trainers cannot be poached. A vacant human job blocks next season. CPU clubs review once per offseason, using performance versus roster expectations, repeated struggles, candidate roster fit and career success. Both finalists and all human clubs are protected from automatic changes. The transaction log records decisions and reasons. New appointments apply next season; completed games retain their original trainers.
- **Coach careers:** the searchable league directory tracks regular-season W–L, playoff game and series W–L, Finals appearances and championships. Open a trainer’s years for club, seed and every series result. Active games count once, and records follow trainers when they change clubs. Older local archives retain known records/titles and flag missing playoff details; their CPU coaches stay for that offseason because the runner-up is unknown.
- **Offseason steps:** a numbered stepper (Development → Review → Rookie draft → Free agency → Coaching → Start; Coaching appears when the league uses trainers) shows each step's status and its next action. When **Start season N** is unavailable, the reason is shown beside it and announced with the button.
- **Next season:** finish the rookie draft, then start a new year with your offseason roster and coaching choices. Any pending CPU free-agent and coaching reviews complete first. You can still adjust positions and coaching before tipoff. A fresh seed generates another 82-game season and best-of-seven playoffs. Franchise years do not inflate challenge attempt counters.
- **Careers:** league-wide regular-season and playoff totals follow Pokémon across trades and remain available after a player is released in a rookie draft. Open a **Career page** for season-by-season teams and production, shooting percentages, skills, development trajectory, awards and championship rings. Live season production contributes immediately; DNPs do not count as appearances.
- **History:** open **View Year N games** for any newly archived season. Filter by club and regular season/playoffs, then open both-team box scores. Historical games use frozen rosters, ratings, rotations and played results. Older years whose original saves discarded detailed stats are clearly marked unavailable; their existing career totals and honors remain.
- **Saving:** the existing v3 browser key supports franchise model 3, interactive season model 6 and played playoff model 2. Prior model paths retain their original outcomes. Completed game prefixes and frozen archives validate against simulation inputs and stored official results. Save failures remain visible with **Retry saving**; play can continue in memory. Saves stay in this browser and are not synchronized through GitHub; use **Export save** to move one. See [Saving](#saving) for backups and recovery.

Injuries, aging, contracts, free agency, generations beyond IX, multiplayer accounts and public hosting are not included.

## Local league with friends

Choose **Local league** in the top navigation for a pass-and-play franchise. Friends manage their teams; the CPU drafts and manages the rest. New leagues offer two progression modes:

- **Generational:** start with Gen I and introduce Gen II–IX in successive two-round offseason rookie drafts. Gen I supports up to 16 eight-player clubs.
- **Full pool:** draft all 1,025 bundled Gen I–IX species immediately, then continue with development and player trades, without future rookie drafts.

Choose 4, 8, 16, or 30 teams (30 requires full pool), 14/28/82 games per team, 4/8/16 playoff qualifiers up to the league size, and single elimination or best-of-3/5/7 series. Legendary/mythical inclusion is optional. Signature abilities and adaptive CPU coaching start enabled. Each team drafts eight unique players in a randomized snake order; CPU picks advance automatically between friends. Draft recommendations explain vacant roles, coaching fit, complementary skills, and available alternatives.

The local scouting board starts with **Team impact** and **Best lineup found · allow moves**. Each available Pokémon is evaluated with position changes for your current players, including starter/reserve swaps. A deterministic search tries multiple starting arrangements and pair swaps using the actual team-rating engine and your chosen priority, coaching and rotation. It finds strong lineups, but does not guarantee an exhaustive global optimum. Every candidate shares a rearranged current-roster baseline, so fixing an old positional mismatch is not credited to the new pick. Search runs in a background worker with progress, and changing the priority cancels obsolete results. Cards show each player's proposed slot, rank across the full pool, projected rating and signed change. Ties share a rank; filters preserve full-pool ranks. **Best open position** keeps existing players fixed and tries every vacancy; you can also choose a single vacant position. **Team fit**, best available and individual position ratings remain available.

The board keeps one recommendation strip (the top three for your chosen ranking) with short explanations of **fit**, **impact** and **vs rearranged baseline**. **Advanced scouting** expands the full-pool ranking controls, recommendation reasons, position locks and the comparison shortlist; adding a player with **+ Compare** opens it. Recommendations and fixed-position rankings also run in the draft worker, so typing and filtering stay responsive with ~1,000 players.

Use **Keep players in place** (under Advanced scouting) to lock or unlock any drafted Pokémon at its current starter or reserve slot. Both the current-roster baseline and every proposed pick respect those locks. Changing locks recalculates the pool and clears outdated pick previews while preserving the shortlist. Locks belong to each friend's team and survive turns and reloads; **Unlock all** clears only that team's locks. Confirmation validates the locks before applying a lineup. Explicit position changes in post-draft team management clear the affected draft locks.

Player cards also show playing style, strongest tools and a relative tradeoff. Choose **View scouting** for visual skill bars, size, position fit and the full report; the **Team impact** preview shows current → projected offense, defense, spacing, creation, rim protection and rebounding for your chosen position. It highlights the largest gain, tradeoff and the new roster’s strongest and lowest-rated areas. Empty slots are excluded, and the first pick is ranked by its starting profile instead of a gain from zero. The preview shows the proposed lineup and moves. Only **Confirm pick & lineup** drafts the player and applies those moves together; selecting a vacant position manually keeps existing players in place.

Use **+ Compare** to shortlist up to three players across searches, then **Compare shortlist** to see their projected team ratings and proposed lineups side by side. The default compares against the shared **Rearranged baseline**; every column uses the exact same proposal as its ranked card. Position and priority remain synchronized. The leader and each row's best ratings include ties; changes and tradeoffs remain visible even when all options lower an average. **Review pick** carries the complete proposal into scouting for confirmation. Individual skills and physical profiles remain available in an expandable comparison. The shortlist resets for each friend’s turn, and draft progress (including accepted moves) saves normally. Ratings describe basketball tools, not win probabilities.

After drafting, **Review friend** lets everyone arrange their roster; a drafted trainer handles game plans and rotations automatically. Legacy teams without trainers retain manual coaching controls. **Simulate local season** produces standings, awards, player statistics and every game box score. Finish the **Playoffs** to name the champion and Finals MVP. **Begin offseason** applies bounded skill development once, opens the next generation's rookie class when applicable, and allows player-for-player trades. Every affected friend must consent; CPU clubs protect roster fit and player value. Review lineups, then **Start year 2** (and onward). **Career history** reopens past seasons using frozen inputs, including their original rosters, statistics, and championship.

**Coaches · hiring and career records** lets each friend manage their own club’s offseason vacancy and appointments. CPU coaching reviews never change a friend’s trainer. The shared directory tracks every trainer across local seasons and clubs. Fill all coaching vacancies before **Start year N**.

Local saves remain under `pokemon-basketball:local-league:v1`, separately from solo/franchise progress. Existing saves retain their original pool, 30-team format, and replay rules; start **New local league** to use the configurable careers. Reloading preserves draft turns, playoff progress, offseason development, rookies and trades. History stores compact inputs and summaries, with detailed games reconstructed on demand. Careers support up to 50 seasons. **New local league** confirms before replacing local career history. This is one-browser pass-and-play, without network multiplayer.

### Understanding results and probabilities

Open **Matchup explorer** in a new local league to select a shooter, defender, shot location, play type, coverage, position, energy and teammate spacing. Its preview averages the won-position and contained outcomes of the same body/type contest used by new simulated games. Compare post leverage, reach and turning/first-step edges, advantage creation chance and conditional shooting probabilities. The controlled scenario excludes blocks/shooting fouls and assumes neutral court, a fresh defender, average help defense, and no passing/screening advantage. Actual games supply current defenders, screens, help, chemistry and signatures.

Local save version 2 uses a bounded logistic shot model with skill, contest, help, spacing, passing, screens, size/strength/speed matchups, closeouts, coverage, transition, nonlinear fatigue, positional fit and clutch/home effects. New seasons add the physical/type contests described below. Size benefits saturate; no species gets automatic baskets. These are game-design coefficients, not a fit to real basketball results. Earlier local and solo seasons keep their saved simulator and deterministic replays.

**Team analysis** in the league center compares estimated points per 100 possessions, eFG%, TS%, turnover rate, free-throw rate, shot mix, offensive rebounds and reserve scoring. Its guide defines each denominator and separates estimates from measured totals. Game boxes include both teams' efficiency factors and actual opposing rebound opportunities. New-model games also compare actual and expected field-goal points on non-foul attempts, excluding free throws and shooting-foul attempts. Descriptive metrics and finishing variance are evidence to investigate, not proof of causation.

New configurable leagues add bounded physical effects, distinct player tendencies, complementary-lineup chemistry, small signatures, and CPU adjustments based on the previous period. No evolutions, injuries, aging, retirement, or draft-pick trading are included. [Engine depth and tuning](docs/ENGINE_DEPTH.md) documents the coefficients and reproducible 3,600-game balance audit.

**Season insights** builds player game trends, five-player lineup statistics, and defensive assignment measures on demand. New game boxes add recorded postgame comparisons, filtered shot charts and event logs, lineups, defense, and coaching changes. Shot coordinates follow simulated court positions under the new court rules; earlier rules use labeled schematic illustrations. Missing historical telemetry is explicitly disclosed. Regular-season qualifications scale with season length.

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

### Possession depth and creation stats

New solo/franchise seasons and new local leagues use versioned possession mechanics. Historical seasons keep their frozen inputs and original replays; existing local careers retain their saved rules.

- Rebound pursuit weighs shot location, individual rebounding, strength, vertical, movement and fatigue. Box-outs reduce an opponent's recovery chances. Inside-out teams commit more players to the glass; run-and-gun and defense-first lineups keep more players back, reducing exposure to the break.
- Defensive rebounds use the rebounder's outlet passing and both teams' speed to shape fast breaks. Live-ball steals create stronger opportunities than dead-ball turnovers. Rebounders can attempt a putback or pass out against help.
- Passing creates a shot opportunity before the make/miss roll. Potential assists, assists, created field-goal points, expected created points, screen assists, rebound chances and box-outs are reported for individual players.
- Open a game or playoff box score's **Inside this result**, or **Season insights → Build season insights**, for possession totals, points per 100 possessions, fast-break points, second-chance points, points off turnovers, paint points and clutch performance. Scoring categories overlap; free throws are included except in paint points. Missing historical or manually played telemetry is never estimated.

Reproduce the seeded tuning audit with `node scripts/possession-audit.mjs --samples=100`; results are saved to `docs/possession-balance-audit.json`. The coefficients are game-design tuning, not a fit to real basketball data.

### Physical and type possession contests

New seasons use `matchupVersion: 1`. The simulator compresses catalog height and weight into reach, mass leverage, turning inertia and workload. These are fictional basketball traits, not anatomical measurements. Extreme catalog dimensions have diminishing returns. Static skill conversion stays unchanged; the new contextual model replaces the older generic physical shot term and screen term.

Offenses select plays and recipients using actual physical/type matchups. Coaches cross-match defenders and weigh both players before switching a screen. A possession resolves post position or separation; beaten defenders can draw help, which makes kickouts attractive. Mass supports post seals, screens and box-outs but costs movement and energy, especially with pace/press tactics. Reach changes shot contests, passing pressure, block risk and short rebounds. Long rebounds reward pursuit. Typing affects advantage creation, decisions and finishing, with bounded resistance instead of automatic stops.

Open **Inside this result → Matchups that shaped the attacks** for actual attacker/defender pairings, dimensions, advantages won, post seals and conditional accuracy shifts. Shot evidence refers to the final shooter and defender after a kickout. Body/action shifts include screens, containment and help; they are not an isolated causal contribution or a counterfactual winning margin. Historical and manually played games without this telemetry remain unestimated.

New solo seasons and configurable local leagues adopt the rules. Standard franchises upgrade at the next season boundary. Existing local careers keep their frozen rules, including future years; start a new local league for the new engine. Archives retain exact prior seeds/results. See [matchup design](docs/superpowers/specs/2026-10-16-pokemon-matchup-engine.md) and [seeded tuning audit](docs/matchup-balance-audit.json). Reproduce with `node scripts/matchup-audit.mjs --samples=100`.


### Court positioning and chained possessions

New solo/franchise seasons and new local leagues use `courtVersion: 2` in the shared match engine; saved seasons and local careers keep the court rules they started with (version 1 or none). Every simulated fixture—including CPU versus CPU, playoffs, and the simulated schedule around manually played games—uses the same rules. User-controlled arcade basketball keeps its separate real-time physics.

Ten players occupy half-court coordinates in feet. Shooting threat determines spacing and defensive shading; current distances influence passing lanes, driving congestion, help, contests and blocks. Recovery speed includes body inertia, speed and energy. Screens lead to drop, switch, hedge, trap or under coverage, selected from the actual matchup and defensive scheme. An offense can pass, drive, kick out or reset before shooting. Actions spend game time and shot-clock time; offensive rebounds reset to 14 seconds. Minutes and fatigue follow time spent on the floor, and substitutions occur between attacks or immediately after foul-outs.

Version 2 fixes four gaps in the original court rules, measured over 600 seeded league games (`node scripts/court-metrics.mjs --court=2 --games=600`):

- **Turnovers:** ball pressure from the defense's steal skill, press scheme, ball handling and decisions now applies on top of pass and drive risk. Turnovers rise from 6.9% to about 12.4% of plays, and steals go to the defender in the passing lane or the one who stripped the drive.
- **Shot selection:** before shooting, players step into the zone their tendencies, coaching tactic and the opposing defense favour. Moving costs time and lets the defender recover. Threes rise from 27% to about 37.5% of shots, and the perimeter and interior tactics change shot mix again.
- **Assists:** a pass that leads straight to a shot counts as an assist about 93% of the time; a catch followed by a drive about 60%. Assisted baskets rise from 32% to about 56%.
- **Fouls:** non-shooting fouls spread across the defense by proximity and discipline, and coaches sit players in foul trouble ahead of their minute targets. Foul-outs fall from about 0.65–0.75 to about 0.2–0.3 a game.

Pace stays near 101 possessions and scoring near 112 points per team. These are game-design coefficients, not a fit to real basketball data.

Open **Inside this result → Court positioning and possession chains** for coverage counts, multi-action attacks, late-clock shots, turnovers, an action browser and a court diagram. These locations influence the engine; earlier schematic shot charts remain labeled as such. Coverage counts and scoring differences are observations, not proof of causation. The model is fictional game tuning, not empirical tracking data.

Standard franchises adopt the update at the next season boundary. Current seasons, archived results and existing local careers keep their saved rules. Start a new local league to adopt the update there. No saved result is silently recalculated under new rules.
