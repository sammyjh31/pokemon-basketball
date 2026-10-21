# Retro league visual system

The selected Kanto clubhouse direction now extends through the game: indigo title bars, warm dialogue surfaces, double pixel frames, raised controls, gold selections and rating blocks, sprites and segmented skill meters. Jersey 10 supplies display type; longer explanations retain Inter and dense numbers keep tabular alignment. Existing town/arena art, Pokémon sprites, trainer portraits, and pixelarticons are reused.

## Screen coverage

| Area | Styling and presentation |
| --- | --- |
| Shared shell | Mode navigation, section navigation, header actions, mobile help links, forms, checkboxes, disclosures, tables, focus/disabled states, notices, progress, saves, footer |
| Draft and scouting | Solo and local cards, filters, rankings, recommendations, shortlist, comparisons, projected lineup, locks, inspector, type/body/ability profiles, rookie draft and pick ledger |
| Team | Court nameplates and roles, ratings, bench, rotation, training, chemistry, morale, mastery, movesets; deeper reports follow the main draft/court |
| Franchise | Offseason steps, roster, coaching directory/careers, development, trade market and packages, free agents, news, history, career detail |
| Competition | Season hub, leader cards, statistics, standings, awards, schedule, playoff stages/bracket/series/champion, game scoreboards and report panels |
| Dialogs | Mode chooser with sprite artwork, restart/import confirmations, guide, body-portaled career/historical reports and box scores |
| Arcade | Setup, opponents, playbook, scoreboard, player strip, touch controls, pause, substitutions, settings, final score and box scores |

The five `retro-*.css` files follow `kanto.css` in the existing entry point. Domain-specific selectors outrank old feature styles loaded on demand. Portal selectors explicitly scope to the active game because those dialogs render outside the app shell. Gameplay, simulation and persistence rules are unchanged.

## Verification

- 118 existing focused UI checks across 24 files passed together.
- TypeScript and the production build with the hosted `/pokemon-basketball/` base passed after final CSS/markup cleanup.
- Additional agent checks: 20 draft/scouting, 57 management, and 18 competition checks passed; these overlap the combined run and are not added to its count.
- Browser checks used isolated in-memory fixtures so the player's save was not reset. Covered the season hub/stat sorting, playoffs/series/box-score reports, trade/scout details, career mastery in its body portal, mode chooser, solo court/cards, local drafting at 390px, and arcade setup/tipoff/pause.
- Matched before/after captures of the current 806px coach-draft screen were reviewed together. Separate desktop and 390px frame captures checked wider and phone layouts.
- Visual issues repaired during QA: court-role/name overlap, faded title bars, long solo-card names, local clock background specificity, mobile toolbar wrapping, arcade roster/energy labels, modal button styling, and career mastery heading/badge contrast.
- Temporary preview fixture files and their server were removed. Screenshots reside in the local visualization folder `2026/10/20/pokebb-retro-every-screen`.

These checks cover representative screens and interactions; they are not an exhaustive enumeration of every generated player or future career state. No full-season engine regression run was required for this presentation change.
