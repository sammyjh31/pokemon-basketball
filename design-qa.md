# All-22 basketball adaptation — design QA

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
