# Player personalities and automatic captains

The user wants Pokémon to react differently to minutes, trades and coaches, and coaches to choose captains whose leadership affects morale and chemistry. This extends the shared morale engine across simulated and playable games, solo/local franchises, transactions, previews and historical reports. No manual management step is introduced.

## Behavior

Each species has a stable, deterministic basketball personality (a game adaptation, not a claim about Pokémon canon). Five 20–90 traits describe ambition, loyalty, resilience, coachability and leadership. A readable archetype and leadership style explain the profile. Profiles use a fixed integer hash of species identity, never current slots, teams, RNG or wins; trades, rookies, save reloads and season changes cannot reroll them.

Personality changes minutes expectations by at most three minutes, sensitivity to playing time and team results, adjustment stress after roster moves, recovery from that stress, and compatibility with the trainer. Existing morale bounds, effective skill caps and 240-minute/40-target rotation limits remain. Immediate transaction effects depend only on identities and prior state, so replay chronology remains independently verifiable.

Each coach automatically selects one captain from the full eight-player roster before each game and after roster/coach changes. Selection uses leadership, raw composure, personality compatibility with the trainer, game experience and earned teammate relationships. Current mood and roster-slot labels do not determine the appointment, preventing daily confidence swings from continually changing captain. No captain id is user-editable or persisted separately: it is derived from frozen pregame team inputs and included in reports. Captains may be bench players.

Captain influence depends on leadership style, confidence and resilience. It changes teammates' postgame morale targets by at most ±3 (never self-boosts). On court it adds at most ±2 cohesion only while the captain belongs to the actual five; no bench chemistry aura, no stacking captains, and no invented shared minutes. The shared lineup model supplies that same effect to coaches, simulated possessions and arcade gameplay. Game reports freeze captain identity and influence for replay.

## Compatibility

Add personalityVersion?:1 requiring moraleVersion1 (and its existing chemistry dependencies). New drafts enable it; old active seasons retain original outcomes and adopt it at the next season boundary. Existing morale snapshots and banks keep their current five-field encoding; all personality/leadership inputs derive from frozen roster/development/coach/chemistry and morale snapshots. All loaders and official game validation enforce matching flags; flag-absent outputs and hashes remain unchanged. Chronology must enable personality at the recorded season boundary while preserving pre-upgrade state.

## Core contract

New src/game/playerPersonality.ts exports:
- PlayerPersonality {pokemonId, archetype, description, ambition, loyalty, resilience, coachability, leadership, leadershipStyle:'Encourager'|'Organizer'|'Challenger'}.
- PersonalityTeam structural roster/coach/development/moraleVersion/morale/chemistryBonds/personalityVersion (import morale types only).
- playerPersonality(id):PlayerPersonality, stable read-only cached profile.
- personalityReactions(team,id): {minutesSensitivity, resultsSensitivity, tradeSensitivity, adaptationRate, expectedMinutesDelta, coachCompatibility, coachFitDelta, updateRate}; legacy neutral multipliers/rates when flag absent.
- TeamLeadership {captainId,score,style,moraleSupport,cohesionBonus,reasons:string[]}.
- teamLeadership(team):TeamLeadership|undefined; undefined if disabled or incomplete roster.
- captainMoraleSupport(team,id,leadership?):number, bounded±3 and0 for captain.

Root owns these helpers, playerMorale integration, match/lineupChemistry/matchChemistry and transaction behavior (existing helper wrappers already used).
MoraleAssessment gains optional personality:PlayerPersonality, coachCompatibility:number, captainSupport:number, captainId:number. MoraleGameReport gains optional captains:{home:TeamLeadership,away:TeamLeadership}. Existing fields/reports unchanged without flag.
ChemistryContext gains leadership?:TeamLeadership; LineupChemistry gains leadership?:{captainId,style,active,cohesionDelta}. Root adds actual-five effect; callers pass teamLeadership from frozen team inputs.

## Verification

Pin the current e8681b9 morale replay hash before enabling the default. Test different reactions under identical circumstances; deterministic profile persistence; captain stability under slot/mood changes, coach influence and automatic replacement; active-five-only bounded chemistry; postgame support and raw-rating invariants; trade/draft/free-agency state; official orientation/replay; modern local multiple seasons/save restore; legacy exact hashes and dependency rejection. Inspect current/history UI on desktop and mobile in isolated browser contexts, never user saves. Build, independent review, commit and push to main.
