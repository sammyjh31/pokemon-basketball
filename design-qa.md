# All-22 basketball adaptation — design QA

## Franchise mode — 2026-10-15

Added an offseason, career and history hub using the existing dark surfaces, gold active controls, local sprites and condensed typography. The eight-player roster persists; the trade desk presents both players' values, the partner's before/after roster rating and its decision. Career tables pin player names on mobile and scroll inside their panel. Selecting a player exposes honors with the original year and team. Entering the offseason moves keyboard focus and scrolls to the new hub.

Evidence: `docs/design/franchise-history-desktop.jpg` (1440×1100) and `docs/design/franchise-offseason-mobile.jpg` (390×844). Checked the career and honors view at 320px too; no document overflow at any checked width. Final captures use explicit screenshot bounds matching the tested CSS viewport because the browser's unbounded screenshot scaled to its default aspect ratio.

Verified a rejected Diglett-for-Venomoth offer, accepted Vaporeon-for-Venomoth trade, trade persistence, new-year roster preservation, starter/bench swap, coaching adjustment and reload before simulation. Completed a second 82-game season (26–56), its 85-game postseason, and another offseason/reload. History correctly keeps Year 1's Cherrygrove title and Year 2's Cinnabar title over Pewter, with Tyranitar Finals MVP (28.2 PPG, 14.8 RPG, 3.7 APG). Vaporeon retains 4,604 points in 164 regular-season games despite changing clubs; Furret's Year 2 Sixth Player award and Tyranitar's ring/Finals MVP appear in career honors.

During development, an old duplicate preview overwrote newer progress when refresh reran effects. Added guards against repeated mount restoration and unchanged-state writes, reproduced the latter in a regression test, closed the duplicate preview and repeated the two-season save check successfully. Checked logs after the final reload contain no warnings/errors. The separate user-origin 69–13 older season remains intact.

214 tests across 34 files passed. TypeScript and production build passed; Vite reports a non-blocking main-bundle size advisory. Review findings on lifecycle bounds and continuation focus are resolved. The prior PNG-export and standalone Playwright CLI verification limits below still apply.

## Eight-player refinement — 2026-10-15

The new feature pass revisited [All-22 scouting](https://all22pokemon.com/scouting) and [patch notes](https://all22pokemon.com/patch-notes). Adapted player scouting, game box scores, season statistics, depth, and coaching; kept the basketball court and existing visual direction. Team-only awards are labeled explicitly.

Evidence: `docs/design/eight-player-results.png` (1440×1000), `eight-player-awards.png` (1440×1000), `eight-player-mobile.png` (390×844), `eight-player-320-awards.png` (320×844), and `eight-player-scouting.png` (1280×720).

Verified eight-slot challenge and free drafting, auto-fill, coaching, expanded scouting, sortable totals/averages, eight-row game details, six awards, overtime minutes, Escape/focus return, and refresh preservation. No document overflow at 1440,390,320px. The mobile table keeps names pinned, puts points/rebounds/assists first, and explains horizontal scrolling. Completed bench cards retain full contrast. New tests cover save migration and old recaps without fabricated statistics.

83 unit/component tests pass; independent code review findings were repaired. Standalone Playwright and downloaded PNG verification limits below still apply. The screenshots and comparison notes below record the earlier visual baseline.

---

**Final result: passed**

Reviewed 2026-10-15. This is a basketball adaptation of [Pokémon All-22](https://all22pokemon.com/), not football feature parity. Five positions, the wood court, existing ratings, two modes, and the 82-game season intentionally replace football formations and 22-player content. Accounts, nine generations, franchises, and public leaderboards are outside this update.

## Evidence and normalization

| View            | Source visual truth             | Rendered implementation                      | CSS viewport / image pixels |
| --------------- | ------------------------------- | -------------------------------------------- | --------------------------- |
| Desktop         | `docs/design/all22-desktop.jpg` | `docs/design/basketball-desktop.jpg`         | 1440×1000 / 1440×1000       |
| Mobile          | `docs/design/all22-mobile.jpg`  | `docs/design/basketball-mobile.jpg`          | 390×844 / 390×844           |
| Narrow mobile   | Mobile source direction         | `docs/design/basketball-320.jpg`             | 320×844 / 320×844           |
| Tablet          | Responsive adaptation           | `docs/design/basketball-tablet.jpg`          | 768×1024 / 768×1024         |
| Mobile controls | Mobile source direction         | `docs/design/basketball-mobile-controls.jpg` | 390×844 / 390×844           |

Source and implementation were rendered in the in-app browser. Paired desktop and mobile images were emitted together in the same comparison inputs. Captures are viewport-only, with no browser chrome, at one image pixel per CSS pixel; no rescaling was used for judgment. Source state is its populated football builder; implementation state is the populated basketball builder (Alakazam, Jolteon, Charizard, Machamp, Snorlax). Different roster count and field proportions are intentional. Supplemental controls evidence contains a changed SG from the placement test.

The full captures make the header, type, labels, and nameplates readable at native size. A separate mobile controls capture provided the focused view of search, type filter, selected/focus states, cards, and share controls below the court. No additional crops were needed.

## Findings and iteration history

1. **[P2, resolved] Desktop share actions sat below the initial view.** The reference puts sharing beside the field title; the first implementation put these tools below a tall court. Moved Save image / Copy link / Randomize / Clear all to the sidebar below the title and reduced the desktop court height. The final desktop capture shows both actions, five players, and team ratings in one view.
2. **[P2, resolved] Mobile New run control was hidden with the court heading.** Restored a compact mobile court heading. Final 390px and 320px evidence shows the button beside the starting-five count; browser visibility check passed.
3. **[P2, resolved] Narrow-screen sprites overlapped the upper players' rating text.** Reduced mobile sprites to 82px, adjusted court height and wing positions, then moved PG clear of the court label. Recaptured and compared at 390px; the 320px capture confirms separate readable names, positions, and ratings.
4. **[P2, resolved] Light and gold button hover text inherited a near-white color.** Removed the generic hover color override. Buttons retain their dark foreground. Code review confirmed the fix.

No actionable P0/P1/P2 visual findings remain. The final comparison accepts basketball-specific content density and court proportions as intentional.

## Required fidelity surfaces

- **Fonts and typography:** local Inter body text and Roboto Condensed bold display/button text match the reference's type direction. Compact uppercase navigation, clear title hierarchy, restrained label tracking, and readable wrapping verified. Accessible mode names now include the visible names.
- **Spacing and layout rhythm:** 340px desktop controls, 28px gutter, large court, compact bordered controls, and a second navigation row on mobile preserve the reference hierarchy. On small screens the court comes before the controls. New run remains available. No horizontal overflow at 320, 390, or 768px.
- **Colors and tokens:** near-black background, subdued panel borders, white builder state, gold challenge/accent state, and blue position text follow the reference. Basketball wood replaces football grass. DOM-based contrast checks on informative UI text/type labels found no ratios below 4.5:1; keyboard focus has a visible gold outline.
- **Image quality and asset fidelity:** actual PokeAPI Gen V transparent pixel sprites, rendered with pixelated scaling, replace the original artwork default. Official artwork remains selectable. All 151 assets are local and hash-verified. No fake Pokémon icons or generated substitutes. Court geometry is the existing basketball game surface, intentionally retained and restyled for this adaptation.
- **Copy and content:** Lineup builder, 82–0 Challenge, five basketball positions, original 151, two rerolls, and season results are consistent. Football formation/account controls were not presented as nonfunctional placeholders. Reference credit is in the footer.

## Interaction and browser evidence

- Desktop and mobile search/filter/placement; keyboard position swaps; randomize/clear; local pixel/artwork switch.
- Copy link fallback displayed a selectable valid URL when clipboard access was unavailable.
- Shared lineup import, acceptance/cancellation over a saved season, and refresh preservation of later edits.
- Two rerolls, five challenge picks, an 82-result season, identical 24–58 result after refresh, and reset cancellation.
- No browser error or warning entries in the checked session.
- 59 unit/component tests and TypeScript/production build passed; independent code review findings resolved.

## Residual test gaps

PNG export's downloaded file could not be verified because browser security denied the download test. The standalone Playwright CLI suite was not rerun in this desktop session. These are recorded verification limits, not visual differences; see `docs/LOCAL_HANDOFF.md`.

## Implementation checklist

- [x] Paired source/rendered desktop and mobile comparisons.
- [x] Fonts, spacing, colors, imagery, and app copy reviewed.
- [x] Responsive controls and sprite spacing repaired and recaptured.
- [x] Core drafting, season, sharing/import, and persistence checked.
- [x] Build, tests, asset manifest, browser logs, and code review checked.
- [ ] Manually confirm a downloaded PNG in a browser with download permission.

Final result: passed

## Full league refinement — 2026-10-15

Extended the existing basketball adaptation with 30 clubs, 240 unique Gen I–II players, eight-player rosters, one shared 1,230-game season, league leaders, player comparisons, full opponent boxes and global honors. The league navigation retains the existing dark panels, gold active states, condensed headings and local Pokémon sprites.

Final evidence: `docs/design/league-awards-desktop.png` (1440×1000) and `docs/design/league-awards-mobile.png` (390×844). Desktop displays all six award winners with team attribution; mobile uses a readable single column. No page overflow at 1440, 390 or 320px. Wide statistics tables scroll within their panels.

Verified searchable leaders and percentage qualification controls; eight-player team rosters; two-player comparisons across clubs; all-game round/team filtering; both-team boxes with eight rows, period scores, minutes, fouls, plus/minus and shot zones; Escape and focus restoration; six global awards and their three finalists. The final QA season was 21–61, with Dragonite of Littleroot winning MVP. Refresh displayed restoration progress and retained the same record and awards. The user's separate-origin 69–13 older season remained intact and clearly explains how to start a new league run.

127 unit/component tests across 21 files and the TypeScript/production build passed. Independent review findings are resolved; checked browser logs contained no warnings or errors. PNG download and standalone Playwright CLI limitations above remain unchanged.

## Postseason — 2026-10-15

Added a full, connected 16-team bracket across first round, quarterfinals, semifinals and Finals. All 15 series remain visible with seeds, series wins, future matchups and winner highlights. Series buttons bring game details into view and move keyboard focus; Back to bracket restores the selected node. Wide brackets and player tables scroll within their panels on mobile.

Evidence: `docs/design/playoffs-bracket-desktop.png` (1440×1100), `playoffs-champion-mobile.png` (390×844), and `playoffs-box-score.png` (1440×1100). Tested 320px Finals details and box-score dialog without page overflow, and 390px player statistics. The completed 89-game postseason shows Cherrygrove beating Littleroot 4–2 and Charizard as Finals MVP with Finals-only averages. All 128 players have postseason totals, with search and team filtering; Charizard's 906 points in 27 games are distinct from his 33.3 Finals PPG.

Verified one-slate progression, refresh at eight games, round completion at 45 games, whole-postseason completion, second refresh, six Finals game results, a full clincher box score, correct home-court pattern, eight players/240 minutes per team in the clincher, and Escape/focus restoration. Regular-season 21–61 remained unchanged. No warning/error entries in checked browser logs. Final verification: 164 tests across 27 files, TypeScript and production build passed; review findings resolved. The prior standalone Playwright CLI and PNG-export limitations remain unchanged.
