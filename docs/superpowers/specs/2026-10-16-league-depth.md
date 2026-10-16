# Local franchise and simulation depth

## Intent

Implement the user's selected roadmap items 2, 3, 8–14, 17–20, plus meaningful Pokémon size/physical effects. Keep existing saves deterministic and the game playable locally with friends. The user explicitly excludes roadmap items 21, 22 and 24; see docs/PRODUCT_CONSTRAINTS.md.

## League and career

New configurable local leagues offer 4/8/16/30 clubs, 14/28/82 games per club, 4/8/16 playoff qualifiers subject to league size, and best-of-1/3/5/7 series. Human managers choose distinct clubs; CPU handles the rest. Pool size must support eight unique species per club.
Two modes: generational begins with Gen I (maximum16 clubs) then GenII–IX rookie classes, two picks per club replacing players; full-pool starts with all1025 bundled species and has no later rookie drafts. Both retain rosters, managers, history, skill development and player trades across seasons. Never mutate a completed season's rosters or replay inputs. After GenIX there are no invented generations. CPU draft picks pause at each human turn. Repeated clicks and refresh must not reapply development or picks.
Keep old local drafts working unchanged. New optional format/career/rules metadata must be validated at load; malformed saves must not be overwritten silently. Use compact frozen season inputs and summaries, not every possession in persistent storage.

## Simulation

New leagues opt into engineRules version1; absence preserves the existing engine exactly. Height and weight give diminishing, bounded effects to reach, screening, rebounding, post contact, agility and movement fatigue. No automatic baskets or guaranteed wins. Distinct tendencies govern usage/shot selection separately from ability. Complementary passing/spacing/finishing roles and continuity have small chemistry effects. CPU coaching adapts to observable matchup/quarter results and shows its decisions. Signature basketball abilities are on by default and optional per new league; effects are small, situational and documented. No evolution or injury effects.
Capture actual simulation events: shots including zone/location, contest/defender, expected chance and outcome; lineup time/scoring; defensive assignments/contests; coaching adjustments. Telemetry must not consume the result RNG. Coordinate locations used only for display must be clearly labeled schematic if not part of shot resolution.

## Visible insights

Draft suggestions explain roster vacancies, complementary strengths, physical tradeoffs, alternatives and scarcity without claiming to know later CPU picks. Game insights show recorded reasons such as turnovers, second chances and finishing variance, shot charts, lineup comparisons and defensive impact. Season insights include player game trends and lineup/defense aggregates with sample sizes. Reconstruct detail on demand with cancellation/progress rather than block the UI. Historical matches without telemetry stay valid and disclose missing detail.

## Balance evidence

Provide reproducible seeded bulk simulations and a runnable balance audit with metrics for score distributions, efficiency, physical extremes, styles and abilities. Sensitivity tests must demonstrate intended effects and deterministic old-save replay. Treat coefficients as game tuning, not empirical calibration.

## Delivery

Use an isolated worktree so the concurrent type-matchup work is preserved. Three independent domains: engine/telemetry, league/career core, analytics UI; parent integrates setup/career UI, draft recommendations and final tests. Verify complete short custom career through two seasons, both progression modes, save restore, custom playoffs and old replay. Then combine reviewed changes into the primary local preview without disturbing browser saves or another chat's work.
