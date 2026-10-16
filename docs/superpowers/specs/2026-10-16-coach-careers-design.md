# Coaching careers and offseason hiring

The user wants to fire/hire trainers in the offseason, have CPU teams change coaches, and follow each trainer's career record, playoff results and titles. Keep the 32 distinct trainers, eight-player rosters, automatic game plans and frozen historical simulations. This applies to solo franchises and local friend careers.

## Decisions

- An offseason coaching office keeps a separate, versioned record of appointments. Changes take effect next season; completed season inputs never change. Firing is reversible by rehiring an available trainer, but a vacant human job blocks the next season. Hiring can replace the current coach directly. Employed coaches cannot be poached.
- CPU clubs review jobs once per offseason, leaving all human clubs alone. Results relative to roster expectations, repeated poor seasons, postseason success and style/roster fit drive bounded turnover. Champions and Finals coaches are protected. Candidates include free trainers and coaches released in this review. Decisions and reasons are visible and persistent; reloads cannot reroll them.
- Career totals are derived from frozen season identities, not current employment. Show regular-season W–L, playoff W–L, series W–L, appearances, Finals, titles and individual year/club/series results. Include active games once; archives never double count. Solo archives already hold playoff results; local archives gain compact coach records. Older local summaries show known regular records/titles and explicitly unknown detailed playoffs instead of invented numbers.
- Available coaches show portraits, styles, roster fit and career record. A coaching directory remains available in season. Explain the scope of automatic decisions and what remains a manager choice.
- The existing match policy/version is unchanged. Coaches directly select plans, workload, lineups, screen preference and live adjustments; shared engine decisions account for typing, physical matchups, court geometry, action chains, scouting and fatigue. Training, transactions and manual arcade controls remain player-managed.

## Compatibility and validation

Persist coaching events separately from active/frozen league inputs. Validate unique employment, known coach IDs, event chronology/from-to matching, human/CPU ownership, complete jobs at season start and cross-season assignments. Preserve existing uncoached saves and the legacy pending initial hire. New fields are optional. Existing records without identifiable coaches remain uncredited.
