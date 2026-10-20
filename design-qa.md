# Kanto Clubhouse visual QA

final result: passed

## Visual truth and state

Selected option: the first displayed Kanto Clubhouse concept.

Source visual truth: `/Users/sam/.codex/generated_images/01a14343-9d71-74b3-9910-6f1fac16f552/exec-7837e595-8bc8-4588-9376-918d70119b8e.png`.

Browser-rendered implementation: `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/desktop-final.png`.
Representative cropped preview: `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/clubhouse-preview.png`.
Live original game tab: `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/live-game.png`.

The reference is 1487 × 1058 raster pixels, approximately a 1440 × 1024 CSS desktop composition at 1.033× density. The implementation was rendered inside a 1440 × 1024 CSS iframe, displayed at scale 0.69 within a 1280 × 720 browser screenshot; the game occupies approximately 994 × 707 pixels. Compare normalized region proportions rather than raw screenshot pixels. The live browser screenshot is 802 × 983 at native CSS scale. Phone checks used a 390 × 844 CSS iframe at scale 1 within the browser; the native 1280 × 720 capture shows the visible portion, with the remainder inspected by scrolling.

State: existing regular-season results, Fortree Flyers, 51–31, league rank 3; Latios scoring/assists leader and Moltres rebound leader. Existing playoff Finals in progress. No simulation batches or picks were advanced on the user's saved 127.0.0.1 origin. Draft checks used a fresh localhost origin and a separate test league.

## Full-view and focused comparison evidence

Source and final desktop screenshots were viewed together in one comparison input. The hero, joined three-column leaders, eight-player roster, cream dialog surfaces, blue navigation, red action and pixel town/arena establish the chosen composition. The record, hero title and leader numbers were enlarged after the first comparison to recover the sports-stat hierarchy.

Focused source and implementation crops were viewed together:

- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/reference-focus.png`
- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/implementation-focus.png`

These cover the hero, record, CTA, sprite treatment, frames and leader row. Additional screenshots cover the deeper feature screens:

- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/desktop-team.png`
- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/desktop-stats.png`
- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/desktop-analysis.png`
- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/desktop-playoffs.png`
- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/draft-prospects.png`
- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/draft-impact.png`
- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/mobile-season-final.png`
- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/mobile-leaders.png`
- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/mobile-playoffs.png`
- `/Users/sam/.codex/visualizations/2026/10/16/01a14343-9d71-74b3-9910-6f1fac16f552/gameboy-2k-2026-10-20/mobile-playoff-controls.png`

## Findings and comparison history

No actionable P0/P1/P2 findings remain in the inspected flows.

1. **P2, above-fold hierarchy:** the first implementation placed league settings and the journey strip above the season hub, pushing the roster below the viewport. Evidence: `desktop-first-pass.png`. Moved settings/save controls into a labeled disclosure below the hub, retaining all controls. Post-fix evidence: `desktop-second-pass.png`, then `desktop-final.png`; the record, arena, leaders and roster are visible together.
2. **P2, contrast and theme consistency:** lazy legacy styles overrode cream panels, heading colors, form fields and button sizes in team management and the draft. Scoped the theme under the app root, corrected the actual prospect selector, themed advanced scouting/lineup impact, and enlarged playoff action labels. Post-fix evidence: `desktop-team.png`, `draft-prospects.png`, `draft-impact.png`, `mobile-playoff-controls.png`.
3. **P2, masthead readability:** small BASKETBALL text and the local exit control lacked contrast. Applied light text and an explicit blue exit surface. Post-fix: `desktop-final.png`, `live-game.png`.
4. **P1, actual standings:** solo summary initially derived rank from the unsorted standings array. It now sorts a copy by wins, point differential, then team ID, consistent with the existing league table. Regression test covers a saved team in array position zero that ranks third.
5. **P2, navigation/interaction:** disabled solo offseason links when their section is absent; Team opens its containing disclosure; local navigation preserves the local route; retained the existing disabled exit guard while simulation is running. Focused tests and independent review verified these fixes.

## Required fidelity surfaces

- **Typography:** self-hosted Jersey 10 provides the pixel display language; existing Inter remains for dense stats/explanations. Navigation, hero and stat values have a clear hierarchy. The generated reference's bespoke raster lettering is not an exact font; Jersey is a deliberate usable approximation. Long team/player names wrap, and actual eight-slot roster names remain readable at 390, 802 and 1440 CSS widths.
- **Spacing/layout:** desktop sidebar, split hero, joined leaders, compact roster and squared dialog framing match the source arrangement. At 900px the sidebar becomes four horizontal tabs; at 600px the hero/leaders stack and the roster becomes four columns. No clipped essential controls observed.
- **Colors/tokens:** cream/paper, indigo/navy, cobalt and restrained red map to the concept. Light neutral secondary controls, visible focus outlines and stronger state colors retain legibility after lazy panels load. Type badges retain their existing type colors on navy backgrounds for contrast.
- **Images/icons:** generated raster arena/town backgrounds match the pixel art direction. Foreground uses the actual selected team's existing Pokémon sprites, with pixel rendering; real trainer art appears only when a coach exists. Modular pixelarticons provide consistent navigation and action icons. No custom SVG illustration substitutes were introduced.
- **Copy/content:** all team names, record, rank, coach, per-game leaders and roster derive from saved game data. No fake Ash, Charizard or sample statistics. The reference's accidental ninth roster placeholder is intentionally replaced with the game's actual eight positions. Existing gameplay explanations and save controls remain available.

## Interactions and verification

Browser checks: season-to-playoffs action, Team navigation opening a hidden roster, sidebar disabled states, player-leader view and search, team-analysis view, mobile playoff controls, fresh local setup, coach draft, scouting a recommended Pokémon and reading lineup-impact details. Main saved playoff history was inspected without advancing it. Existing save isolation and simulation code remain unchanged.

- Related component suite: 51 tests passed across seven files (KantoShell, KantoSeasonHub, SeasonStats, LeagueVisuals, LeaguePanel, PlayoffPanel, LocalLeagueDraft).
- Focused local-league/setup/save-return and new regressions: nine passed, twelve unrelated tests skipped.
- Independent read-only review verified the rank, offseason navigation and busy-exit fixes; no remaining functional blocker found.
- Production build and TypeScript checks passed; existing large-bundle warning remains.
- Formatting and whitespace checks passed.
- Native in-app browser did not expose console-log diagnostics; no runtime error UI appeared in tested flows. A full season replay, complete franchise offseason and every analytics subpanel were not rerun for this visual change.

## Accepted differences and follow-up polish

Real-team sprites, statistics and optional coach replace the mock's illustrative content. Arena artwork is a reusable generated background rather than baked Charizard/score graphics. The implementation uses cleaner double-line frames instead of reproducing every raster corner/scanline from the concept. These preserve the selected direction while allowing live game state and responsive layouts.

P3: further decorative pixel corners and a more bespoke wordmark could make the framing closer to the generated reference. The desktop sidebar retains its top inset when the masthead has scrolled away. These do not block play or hide controls.

## Implementation checklist

- [x] Apply selected art direction to existing game.
- [x] Preserve live statistics, simulation rules, saves and eight-slot roster.
- [x] Check desktop, tablet and phone composition.
- [x] Verify draft, season statistics, team management and playoffs.
- [x] Resolve actionable review/visual findings.
- [x] Save browser evidence and retain the playable local preview.
