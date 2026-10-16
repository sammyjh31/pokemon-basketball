# Offseason overhaul

## Intent and confirmed rules
Make team building deeper and easier: multi-player trades, CPU coaches with basketball priorities, editable offseason rosters, a searchable market with availability and accepted suggestions, and a rookie draft every offseason. The user confirmed eight-player clubs, equal 1/2/3-player packages, and two rookie rounds with each rookie replacing one player.

## Trade market
Use a deterministic shared evaluator for previews, accepted suggestions and CPU negotiations. Evaluate package ability, vacant-slot fit, coaching scheme, positional coverage, team weaknesses, recent development, championship continuity and club direction derived from last season. Availability labels (available/listening/core) communicate asking price, never secretly prevent an otherwise acceptable offer. Retain talent floors so many weak players cannot buy a star. Search all 232 opponent players by name/team/position/availability. Let the user select a target or outgoing package and request accepted suggestions; re-evaluate at execution. Suggestions are a bounded search, not a promise all possible trades have been exhausted. CPU trades remain at most six per offseason with at most one per club.

## Roster management
Offseason changes apply only to franchise.teams[0], never the finished run or archives. Swap any two of the eight slots, set offense/defense/rotation and 240 minutes/five closers. Changes carry into the next season. Each trade/draft replacement inherits its destination slot's minutes. Training follows retained owned species; remove plans for departed players.

## Rookie draft
Each unprocessed offseason has two rounds, 30 picks per round, worst prior-season record first (stable team-id tie break after point differential). First draft introduces Gen III, then IV through the latest bundled generation; afterward use remaining never-drafted/never-rostered prospects. Preserve the initial Gen I–II player pool and every existing species' facts to keep old simulations deterministic. Each pick immediately replaces one existing roster member. CPU clubs choose by ability and roster need; user selects both rookie and release, with recommendations. Advance CPU picks to the next user turn, with progress and a reviewable draft board. Trades cannot interleave a partially completed draft; starting the next season requires draft completion. Preserve career and honor records for released players and log every pick/release. No invented later generations; when eligible prospects are exhausted, remaining picks are skipped visibly and the franchise can continue.

## Save boundaries
Package transactions are atomic, store 1–3 IDs per side plus legacy first-ID fields, and validate ownership/unique species. Draft records store their trade-log insertion boundary so validation replays trades and replacements in exact order. Rich historical archives remain frozen. Save restoration validates newly introduced species, variable historical career membership and current rosters without rewriting old outcomes. Existing franchises can opt into their first rookie draft in the next offseason; no retroactive draft in completed years.

## Verification
Red/green tests cover invalid and stale packages, fairness beyond ratings, accepted suggestions, CPU behavior, offseason edits, draft order/uniqueness/60 picks, generations, departure careers, save corruption and partial-draft reloads. Full suite/build plus browser trade, roster, draft, next-season, history and mobile checks. Keep unrelated primary-checkout work intact; commit/push tested changes.

## Defensive statistics follow-up
The user also requested defensive stats during implementation. Expose a focused Defense view in regular-season/playoff league leaders, franchise careers and individual career pages. Show recorded steals, blocks, defensive rebounds and personal fouls, their per-game/totals values and per-36 rates; clearly define stocks as steals plus blocks. Keep zero-minute rates unavailable and do not invent defensive matchup/on-off data. Split offensive/defensive rebounds in every current and historical box score. Verify sorting, filtering, totals, rates, postseason and released careers.
