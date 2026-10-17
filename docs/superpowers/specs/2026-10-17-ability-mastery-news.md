# Ability mastery and league news

The user approved persistent ability mastery and a league-wide news feed, with coach-managed training, trade/season carryover and GitHub delivery. Integrate current main (03d2f61), preserve the newer CPU/court/save rules, and work only in this attached worktree. No approval gates remain for this authorized implementation.

## Mastery

Add abilityMasteryVersion?:1 (requires abilityVersion1), abilityMastery?:Record<number,number> to teams and relevant drafts/run/arcade metadata. Exactly eight current species records, XP rounded to hundredths within0..1000. New games enable it; existing active seasons retain their original rules and existing franchises adopt at the next season boundary, without retroactive XP. Carry100% across seasons/trades. Rookies start0; released players retain earned mastery if later signed. No duplicate awards on reload or historical viewing.

Tiers at0/75/200/400/700: Developing/Practiced/Skilled/Expert/Master. Each completed official fixture earns0..1.5XP based on normalized actual minutes and bounded recorded offensive/support/defensive/physical ability usage. Coachability and trainer adaptability influence learning. Zero minutes or disabled abilities earn no game XP. Practice arcade earns no persistent XP. Pregame8-number arrays freeze each side's mastery, just like morale snapshots; updates apply only after the fixture. Save/load and official-game submission validate frozen rules/state.

Offseason coach training adds bounded XP (roughly12..65), using assigned focus, coaching fit, coachability and a deterministic occasional breakthrough; use a separate seed so existing development randomness stays unchanged. Automatic training considers ability mastery opportunity while respecting existing recovery and workload constraints. Emit recorded before/after training changes with reasons. Mastery affects both simulated and playable games, shared valuation and coaching. Scale only the existing ability delta: factor smoothly increases1.00..1.20 across tier intervals, never an extra20 percentage points or base-stat change. The same transform applies shooting/support/defense and movement/screens/navigation/rebounds/drain/recovery. Disabled abilities remain off. Historical flag-absent outputs remain exact.

## News

Build a pure, deterministic league-wide feed from current/archived results and recorded transactions, coaching history, honors, development and mastery milestones. No fabricated quotes, motives, tactical changes or causal claims. Stable IDs remove duplicates. Include all clubs, season selector, your-team filter and categories (all, games, development, transactions, honors/coaching). Highlight tier breakthroughs and meaningful player development, major performances/weekly result roundups, trades, draft picks, signings, coaching moves, awards/championships. Provide source context and links/buttons into existing player/game/detail views where available; otherwise show explicit recorded detail in the story. Persist underlying events, derive the feed without resimulating seasons or storing redundant prose. Preserve historical seasons. Integrate solo and local franchises plus season/league results where feasible.

## Interfaces and ownership

Root: masteryMath.ts, abilityMastery.ts, core tests, docs and integration review.
Lifecycle owner: types/run/team/summary/report fields; drafts/league/season/playoffs/archives/official/franchise/local/persistence; bank chronology and roster transactions/free agency; offseason rewards and training report storage. New helper functions live in root abilityMastery.ts; see plan.
Engine owner: abilities.ts, physicalAbilities.ts, simulated match and court consumers, matchLineups, arcade/*, ability/physical/shared evaluation, coachPolicy/coachTraining and relevant tests. Uses pure masteryFactor(xp) and optional final xp parameters; no direct persistence mutations.
News/UI owner: leagueNews.ts and dedicated tests/components/styles, mastery/news panels, App/component integration and UI tests. No game lifecycle mutations. Coordinate exact report shapes with owners.

## Verification

Freeze pre-mastery match/arcade hashes. Test actual effects and caps, zero/disabled use, official full/compact parity, transactions including release/re-sign, rookie0, playoff carryover, deterministic coach training, no double credit, tamper/mixed-version rejection, multiple seasons and old-save migration. News tests require cross-team coverage, stable deduplication/order and recorded-source accuracy. Desktop/mobile browser checks use isolated contexts, preserving user saves. Build/typecheck, focused regressions, a full season/playoffs/restore integration, independent review, commit and push main; verify remote SHA.
