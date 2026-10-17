# Persistent player morale

Add versioned player morale to every newly started game mode and to existing franchises at the next season boundary. Current historical seasons retain their old engine. No manual morale controls.

Each current roster player stores score (0–100), recent regulation-equivalent minutes, recent team win rate (0–100), transition disruption (-10–10), and completed game count. New players start neutral (50,0,50,0,0). Expectations come from raw developed talent rank, independent of coach-assigned minutes. Fit comes from raw skills and trainer style. After each completed game, moving averages of actual playing time and results update morale gradually. Automatic coaching support moderates slumps and transition stress. Values and effects are capped. Season boundaries carry half of the distance from neutral and soften transition stress.

Pregame morale is frozen. It adjusts effective basketball execution by at most three skill points and actual-five cohesion by at most four points, without changing base ratings, physical dimensions, development or earned shared minutes. Coaches consider it in shared evaluation, rotations, game plans and training intensity. Reports explain expectations, recent minutes, fit, success, transition effects and the automatic response.

Trades carry the incoming player's state from the donor and apply adaptation stress; remaining teammates experience a small capped disruption. Rookies start neutral with adaptation stress. Free agents start a fresh opportunity with mild adaptation stress. State belongs only to current roster species, never roster slots. Immediate transaction changes depend only on roster identities and prior state, allowing exact independent chronology verification. Offseason retention is also independent of current skills/coaches; coaching fit acts during subsequent games.

Simulation, played official games, season/playoff accumulators and archived box scores share the same postgame update. Compact pregame snapshots preserve replay, saves validate snapshots and full chronological provenance, and restore never credits games twice. UI reads latest banks, not frozen season-start teams. Match effects and report generation never draw RNG values.

## Core interfaces (playerMorale.ts)

- PlayerMorale {score, minutes, success, disruption, games}; MoraleRoster = Record<number,PlayerMorale>; MoraleBanks = Record<number,MoraleRoster>.
- MoraleFixture {home:number[], away:number[]}: each side is 40 numbers, sorted roster species, fields ordered score/minutes/success/disruption/games.
- MoraleTeam structural type: roster, optional moraleVersion:1, morale, coach, development.
- neutralMorale(); moraleState(team,id); moraleScores(team); moraleSkillDelta(team,id); moraleProfile(profile,team,id).
- moraleAssessment(team,id): {pokemonId,score,status,expectedMinutes,recentMinutes,fit,success,disruption,action,actionLabel,minuteAdjustment,skillDelta,reasons:string[]}.
- advanceMorale(team,boxes,won,overtimePeriods=0): MoraleRoster.
- moraleGameReport(home,away,match): MoraleGameReport | undefined; report {home:MoralePlayerReport[],away:...}, rows assessment plus before/after scores. LeagueMatch.moraleReport optional.
- snapshotMorale(home,away); applyMoraleSnapshot(team,values); initialMoraleBanks(teams); teamsWithMorale(teams,banks); recordMoraleGame(banks,home,away,match); validateMoraleRoster(raw,team).
- withRosterMorale(updatedTeam,previousTeam,sources,kind:'trade'|'rookie'|'free-agent'): generic team. All sources are BEFORE transaction, preserving simultaneous swaps.
- retainMorale(team): enables version1; softens existing state once, or initializes neutral. Requires caller enable chemistryGrowthVersion1/chemistryVersion1.

Run.moraleVersion optional1, LeagueTeam.moraleVersion/morale optional, LeagueFixture.morale optional snapshot, LeagueResult/Playoffs.morale optional banks, LeagueMatch.moraleReport optional. Morale requires chemistryGrowthVersion1. Arcade state holds frozen moraleInitial snapshot, moraleVersion, with scores in chemistry contexts. All version-absent output must remain unchanged.
