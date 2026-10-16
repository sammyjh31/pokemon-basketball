# Franchise free agency

The user wants released rookie-draft players to remain useful franchise assets: sign them by replacing one owned player, and allow CPU clubs to do the same. Eight-player rosters and unique species across all 30 clubs remain mandatory.

The offseason Free agents tab opens after that year's completed rookie draft and development. Its searchable pool consists only of players actually released in a draft or free-agent replacement who are no longer on an active roster. Unsigned players carry forward; undrafted prospects are excluded. Existing franchises derive the initial pool from their draft records, without a reset. Each signing shows the incoming player and outgoing release before an explicit Sign and release action. The replacement inherits the roster slot and minutes; the outgoing training plan is removed. Careers and development offsets follow the Pokémon. Completed games and archives remain immutable.

CPU free agency is a deterministic, once-per-offseason round, weak teams first, at most one signing per CPU club. It evaluates positional fit, roster quality, coaching and developed ratings, protects that year's rookies from immediate cuts, and signs only meaningful upgrades. The user has the first opportunity; a Run CPU free agency button exposes the activity report. Starting the next season runs the round automatically if it has not happened. Later manual signings remain possible before the next season.

Persist a versioned optional freeAgency extension with signing transactions and processed CPU years. Each transaction records its year, club, signed/released species, source, reason and the number of trades preceding it. Validate draft → interleaved trades/signings → following season chronologically, reject duplicate ownership or forged eligibility, and derive free-agent development from existing offseason reports. Older saves without the extension retain their behavior. Local leagues are unaffected.

No contracts, salaries, free-agent bidding, standalone release action or in-season signings are introduced.
