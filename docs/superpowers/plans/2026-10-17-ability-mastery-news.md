# Ability Mastery and League News Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for owned domains. Independent lifecycle, engine and news/UI domains proceed in parallel using the contract below.

**Goal:** Persistent ability progression with automatic training and a factual league-wide news feed.
**Architecture:** Frozen pregame mastery and postgame banks share one pure progression model. News derives from stable recorded sources. Historical version flags preserve old results.
**Tech Stack:** TypeScript, React, Vite, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-17-ability-mastery-news.md

## Global constraints
- XP 0–1,000, rounded to hundredths; tier thresholds 0/75/200/400/700; ability delta multiplier 1–1.20.
- Eight species records; carry across teams/years; new rookies start at zero; no retroactive XP.
- No additional RNG draws from existing match/development streams; frozen eight-value snapshots preserve replay.
- Never touch user browser saves, primary checkout, unrelated processes, or stage node_modules.

## Review focus
- Partial/away official fixtures need correctly oriented frozen mastery and version checks.
- Archived news and box viewing cannot change XP or duplicate stories.
- Trades and free-agent releases/signings cannot reroll or lose XP; incoming rookies cannot inherit slot mastery.
- Turning abilities off disables effects, recruiting value and earned XP.
- Pre-version hashes, legacy current seasons and next-season upgrade must all stay valid.

## Shared interfaces

masteryMath.ts exports MasteryLevel={index:number,name:string,start:number,next:number|null}, masteryLevel(xp:number), masteryFactor(xp=0):number; invalid values clamp safely in display math, strict validators reject saved invalid values.

abilityMastery.ts exports MasteryRoster=Record<number,number>, MasteryBanks=Record<number,MasteryRoster>, MasteryFixture={home:number[],away:number[]}, MasteryTeam structural roster/coach/abilityVersion/abilityMasteryVersion/abilityMastery/personalityVersion/engineRules.
- masteryXp(team,id):number; validateMasteryRoster(raw,team):MasteryRoster.
- snapshotMastery(home,away):MasteryFixture|undefined; applyMasterySnapshot(team,values):team.
- initialMasteryBanks(teams), teamsWithMastery(teams,banks), advanceMastery(team,boxes,overtimePeriods=0):MasteryRoster; recordMasteryGame(banks,home,away,match):void.
- masteryGameReport(home,away,match):MasteryGameReport|undefined with home/away rows {pokemonId,before,after,gained,levelBefore,levelAfter}; level fields are tier names.
- masteryMilestones(home,away,match):MasteryMilestone[]; {teamId,pokemonId,before,after,gained,levelBefore,levelAfter} only tier changes; summary fields mastery?:MasteryFixture and masteryMilestones?:MasteryMilestone[].
- retainMastery(team) adopts version1 and keeps enabled prior XP, initializes legacy0.
- withRosterMastery(team,previous,sources,kind,incoming?:MasteryRoster):team; kind trade/rookie/free-agent; reconstruct exact current8 records, sources current donor rosters, optional incoming for released free agents.
- trainMastery(team,assignments,year,seasonSeed):{mastery:MasteryRoster,changes:MasteryTrainingChange[]}; change {teamId,pokemonId,before,after,gained,levelBefore,levelAfter,focus,breakthrough,reasons:string[]}. assignments map to {plan:PlayerTrainingPlan} (existing coach assignment compatible). Team id required only training/milestones/banks.
OffseasonReport.mastery?:MasteryTrainingChange[]; LocalSeasonArchive.mastery uses the same shape. Archived newsGames stores compact completed-game facts; local newsPlayers stores scoring highs for archived performance stories.

## Tasks
- [x] Root: pin old hash; write failing math/progression/snapshot/training tests; implement pure helpers. Verify bounded effects contract and actual-game reports once wired.
- [x] Lifecycle: add flags/banks/snapshots/summary milestones and loaders; account official and simulated fixtures once; lifecycle/trade/draft/free-agent/offseason carryover; strict chronology. Test modern and legacy multiple seasons, tampering and release/re-sign.
- [x] Engine: optional XP effect scaling everywhere, frozen simulated/arcade player XP, shared valuation/training, strict rule checks. Pin old replay; test caps, off switches and real action differences.
- [x] News/UI: deterministic fact-based story model with stable IDs/categories/team/year; current/historical mastery, training changes and news views; cross-team tests and isolated responsive browser verification.
- [x] Integrate/review/build and run modern/legacy/full-season/restore checks. Update README and record verification.

Delivery: commit the verified change and push to main, then confirm the remote SHA. See the companion verification record for test coverage and limits.
