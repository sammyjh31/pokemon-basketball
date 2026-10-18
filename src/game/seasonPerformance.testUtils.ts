import type { Run } from "./types";

/** Frozen inputs from main before the performance pass, independent of new-run defaults. */
export function performanceRun(): Run {
  return {
    id: "run-822",
    typeMatchupsVersion: 1,
    typeTacticsVersion: 1,
    abilityVersion: 1,
    abilityMasteryVersion: 1,
    physicalAbilityVersion: 1,
    chemistryVersion: 1,
    chemistryGrowthVersion: 1,
    moraleVersion: 1,
    personalityVersion: 1,
    evaluationVersion: 1,
    courtVersion: 4,
    matchupVersion: 1,
    possessionVersion: 1,
    gameFlowVersion: 1,
    mode: "free",
    includeLegends: true,
    roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
    tactic: "balanced",
    rotation: "balanced",
    defense: "man",
    offerIds: [],
    rerollsLeft: 2,
    draftSeed: 2738958938,
    seasonSeed: 3355524498,
    result: null,
    coach: { version: 1, id: "misty" },
  };
}
