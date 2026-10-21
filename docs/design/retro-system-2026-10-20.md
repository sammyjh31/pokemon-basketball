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
| Trainer gallery | Linked credits page with local portraits, shared typography, framed credits table, readable mobile layout |
| Dialogs | Mode chooser with sprite artwork, restart/import confirmations, guide, body-portaled career/historical reports and box scores |
| Arcade | Setup, opponents, playbook, scoreboard, player strip, touch controls, pause, substitutions, settings, final score and box scores |

The five `retro-*.css` files follow `kanto.css` in the existing entry point. Domain-specific selectors outrank old feature styles loaded on demand. Portal selectors explicitly scope to the active game because those dialogs render outside the app shell. Gameplay, simulation and persistence rules are unchanged.

## Verification

- 118 existing focused UI checks across 24 files passed together.
- TypeScript and the production build with the hosted `/pokemon-basketball/` base passed after final CSS/markup cleanup.
- Additional agent checks: 20 draft/scouting, 57 management, and 18 competition checks passed; these overlap the combined run and are not added to its count.
- Browser checks used isolated in-memory fixtures so the player's save was not reset. Covered the season hub/stat sorting, playoffs/series/box-score reports, trade/scout details, career mastery in its body portal, mode chooser, solo court/cards, local drafting at 390px, arcade setup/tipoff/pause, and the linked trainer gallery.
- Matched before/after captures of the current 806px coach-draft screen were reviewed together. Separate desktop and 390px frame captures checked wider and phone layouts.
- Visual issues repaired during QA: court-role/name overlap, faded title bars, long solo-card names, local clock background specificity, mobile toolbar wrapping, arcade roster/energy labels, modal button styling, and career mastery heading/badge contrast.
- Temporary preview fixture files and their server were removed. Screenshots reside in the local visualization folder `2026/10/20/pokebb-retro-every-screen`.

These checks cover representative screens and interactions; they are not an exhaustive enumeration of every generated player or future career state. No full-season engine regression run was required for this presentation change.

## Draft flow refinement

The follow-up audit of the live challenge draft found that selecting a Pokémon left its identity and placement controls below the court and card grid. Draft navigation also targeted the enclosing fieldset, so phone users landed at the court instead of available players.

- Added a contextual pick station to solo challenge and free drafting. It keeps the portrait, basketball role, position fit and explicit placement action visible. It defaults to the player's highest-rated open starting position, then bench depth; this is individual fit, not a team-impact forecast.
- Challenge options exclude occupied slots. Free-draft replacements name the departing Pokémon before confirmation. Cancel returns focus to the selected card; background jobs and open dialogs disable the station.
- Draft navigation now targets the player board, with the existing local-league draft target as a fallback.
- Solo cards now show the engine's basketball archetype and segmented shooting, finishing and defense bars. Numeric ratings remain visible and are included in each card's accessible description.
- The compact phone station uses two rows and reserves page-end space. Existing lineup placement and detailed scouting remain available.

Verification: 28 focused component checks plus 7 draft App checks passed; TypeScript and the hosted-base production build passed. Independent review found no blocking issues. Browser QA covered desktop placement and 390px cancellation/reselection using isolated in-memory saves. Proof captures are in `2026/10/20/pokebb-draft-polish`. This refinement is local until the next requested publication.

## Season statistics and postseason refinement

The next pass keeps the existing retro palette and actual Pokémon artwork while making the competition screens easier to explore. Fresh desktop captures showed tall repeated headers and large spotlight cards pushing the table below the fold; the selected playoff report also preceded the bracket that chose it.

- Team, league and playoff statistics share a ranking picker and highest/lowest order control. They use the table's existing sort state, qualification rules, filters and calculations. Cards and the table stay in sync, and percentage/count/rate labels describe the actual value rather than implying every stat is a per-game average.
- Compact stat headers and framed player portraits lead into three readable cards. The first visible player has the dark-and-gold treatment. Numeric tables use condensed tabular figures, sticky headings, a persistent player column and a bounded scroll region.
- Playoffs provide both the complete connected bracket and a round matchup view. Phones initially use round matchups; every round remains browsable, including future matchups. Round cards show actual roster sprites, seeds and series wins. Users can return from a browsed round to the active round.
- The bracket now precedes the selected-series report. Selecting a series still moves keyboard context to its report, and Back to bracket restores it to the corresponding series. Simulation controls retain their existing busy/completion guards.
- Arena artwork, trophy icon, champion roster and Finals MVP card extend the same visual system through the championship result. Seeding/home-court rules live in an expandable explanation. Phone round browsing avoids duplicating the stage tracker and keeps simulation buttons usable.

Verification: 52 focused checks passed across season stats, league leaders, playoff presentation, box scores, league visuals and hosted asset paths. TypeScript and the production build with the hosted base passed. Independent code review found no blocking issues. Browser QA used isolated preview data, without changing the player's save, for desktop and 390px layouts, phone stat selection, future rounds and championship honors. Captures are in `2026/10/20/pokebb-competition-polish`. New CSS is in `competitionPolish.css`, imported after the existing theme; simulation and saved-game formats are unchanged. This pass is local until publication is requested.

## Unified retro typography and restrained motion

All visible text now uses the same Jersey 10 face as the established draft headings. The final typography layer overrides earlier feature font shorthands, including lazy panels, portal dialogs and controls. Smaller body copy and helper text have been enlarged for the pixel face. The standalone trainer gallery uses the same locally bundled font, and arcade canvas labels measure and draw with Jersey 10. Unused Inter/Roboto Condensed font imports have been removed.

Motion is limited to short, finite entrances for panels/dialogs, stat cards and championship honors, a selected-card sprite acknowledgment, and small pointer hover feedback. Animations use individual translate/scale properties on the affected elements; positioned court players and game clocks are unchanged. All added motion is gated by the system motion preference, with a reduced-motion rule disabling transitions and animations across normal screens and portals.

Verification: 66 focused checks passed across stats, playoffs, draft navigation/placement, hosted assets, arcade flow and rendering. Production build and TypeScript passed. Browser checks covered the draft pick panel, mode chooser, statistics, phone playoff cards, live arcade play/pause, and trainer credits. A computed-style check found 439 draft text elements and 31 dialog elements all using the retro family. Independent review found no blocking issue. Proof captures are in `2026/10/20/pokebb-retro-font-motion`. Temporary preview fixtures were removed before publication.
