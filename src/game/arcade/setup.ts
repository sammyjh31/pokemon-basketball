import {
  masteryXp,
  snapshotMastery,
  validateMasteryRoster,
} from "../abilityMastery";
import { POKEMON_BY_ID } from "../../data/pokemon";
import { playerProfile } from "../playerProfile";
import { emptyAbilityActivations } from "../abilities";
import { clamp } from "../ratings";
import { createEvaluationContext, evaluatePlayer } from "../teamEvaluation";
import { POSITIONS, ROSTER_SLOTS } from "../types";
import { snapshotChemistry, validatePairBonds } from "../teammateChemistry";
import {
  moraleProfile,
  moraleScores,
  snapshotMorale,
  validateMoraleRoster,
} from "../playerMorale";
import { teamLeadership } from "../playerPersonality";
import { refreshArcadeChemistry } from "./chemistry";
import type {
  ArcadePlayer,
  ArcadeSetup,
  ArcadeState,
  ArcadeStats,
  Side,
} from "./types";
export const emptyStats = (): ArcadeStats => ({
  seconds: 0,
  points: 0,
  fgm: 0,
  fga: 0,
  threePM: 0,
  threePA: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
  turnovers: 0,
});
export function createGame(setup: ArcadeSetup): ArcadeState {
  const used = new Set<number>(),
    players: ArcadePlayer[] = [];
  if (
    !setup ||
    setup.teams?.length !== 2 ||
    !Number.isFinite(setup.seed) ||
    (setup.chemistryVersion !== undefined && setup.chemistryVersion !== 1) ||
    (setup.chemistryGrowthVersion !== undefined &&
      (setup.chemistryGrowthVersion !== 1 || setup.chemistryVersion !== 1)) ||
    (setup.moraleVersion !== undefined &&
      (setup.moraleVersion !== 1 ||
        setup.chemistryGrowthVersion !== 1 ||
        setup.teams[0].moraleVersion !== setup.teams[1].moraleVersion ||
        setup.teams.some(
          (team) =>
            team.moraleVersion !== undefined && team.moraleVersion !== 1,
        ))) ||
    (setup.personalityVersion !== undefined &&
      (setup.personalityVersion !== 1 ||
        setup.moraleVersion !== 1 ||
        setup.teams[0].personalityVersion !==
          setup.teams[1].personalityVersion ||
        setup.teams.some(
          (team) =>
            team.personalityVersion !== undefined &&
            team.personalityVersion !== 1,
        ))) ||
    (setup.abilityMasteryVersion !== undefined &&
      (setup.abilityMasteryVersion !== 1 ||
        // The top ability flag controls live effects. Disabled official leagues
        // still freeze mastery from clubs using the underlying ability rules.
        (setup.abilityVersion !== 1 &&
          !setup.teams.every(
            (team) =>
              team.abilityVersion === 1 &&
              team.engineRules?.abilities === false,
          )) ||
        setup.teams[0].abilityMasteryVersion !==
          setup.teams[1].abilityMasteryVersion ||
        setup.teams.some(
          (team) =>
            team.abilityMasteryVersion !== undefined &&
            team.abilityMasteryVersion !== 1,
        ))) ||
    (setup.abilityVersion !== undefined && setup.abilityVersion !== 1) ||
    (setup.physicalAbilityVersion !== undefined &&
      setup.physicalAbilityVersion !== 1) ||
    (setup.evaluationVersion !== undefined && setup.evaluationVersion !== 1)
  )
    throw new Error("Choose two complete teams to play.");
  const masteryTeams =
    setup.abilityMasteryVersion === 1
      ? setup.teams.map((team) => ({
          ...team,
          abilityVersion: 1 as const,
          abilityMasteryVersion: 1 as const,
          // Court flags are authoritative, including when per-club rules are disabled.
          engineRules: { ...team.engineRules, abilities: true },
          ...(team.abilityMastery === undefined
            ? {}
            : {
                abilityMastery: validateMasteryRoster(
                  team.abilityMastery,
                  team,
                ),
              }),
        }))
      : undefined;
  const moraleTeams =
    setup.moraleVersion === 1
      ? setup.teams.map((team) => ({
          ...team,
          moraleVersion: 1 as const,
          // Court rules are authoritative for historical and practice setups.
          personalityVersion: setup.personalityVersion,
          ...(team.morale === undefined
            ? {}
            : { morale: validateMoraleRoster(team.morale, team) }),
        }))
      : undefined;
  const bonds =
    setup.chemistryGrowthVersion === 1
      ? setup.teams.map((team) => {
          const history = validatePairBonds(team.chemistryBonds ?? {});
          const rosterIds = new Set(Object.values(team.roster));
          // The live cache only needs this game's roster. Clubs keep archived
          // relationships in their own bank for future reunions.
          return Object.fromEntries(
            Object.entries(history).filter(([key]) =>
              key.split(":").every((id) => rosterIds.has(Number(id))),
            ),
          );
        })
      : undefined;
  const leadership =
    setup.personalityVersion === 1
      ? moraleTeams!.map((team, side) =>
          teamLeadership({ ...team, chemistryBonds: bonds![side] }),
        )
      : undefined;
  setup.teams.forEach((team, side) => {
    const evaluation =
      setup.evaluationVersion === 1
        ? createEvaluationContext({
            ...team,
            tactic: team.tactic ?? "balanced",
            // Evaluate the abilities actually active on this court.
            abilityVersion: setup.abilityVersion,
            abilityMasteryVersion: setup.abilityMasteryVersion,
            physicalAbilityVersion: setup.physicalAbilityVersion,
            chemistryVersion: setup.chemistryVersion,
            chemistryGrowthVersion: setup.chemistryGrowthVersion,
            chemistryBonds: bonds?.[side],
            moraleVersion: setup.moraleVersion,
            personalityVersion: setup.personalityVersion,
            engineRules: {
              ...team.engineRules,
              abilities: setup.abilityVersion === 1,
            },
          })
        : undefined;
    ROSTER_SLOTS.forEach((slot, i) => {
      const id = team.roster[slot],
        mon = id == null ? undefined : POKEMON_BY_ID.get(id);
      if (!mon || used.has(mon.id))
        throw new Error("Both teams need eight distinct Pokémon.");
      used.add(mon.id);
      const rawProfile = playerProfile(mon, team.development?.[mon.id]);
      const profile = moraleTeams
        ? moraleProfile(rawProfile, moraleTeams[side], mon.id)
        : rawProfile;
      players.push({
        id: players.length,
        pokemonId: mon.id,
        name: mon.name,
        type: mon.types[0],
        team: side as Side,
        slot: i < 5 ? POSITIONS[i] : profile.bestPosition,
        active: i < 5,
        x: side === 0 ? 8 : 20,
        y: 2 + i * 2.5,
        vx: 0,
        vy: 0,
        z: 0,
        facing: side === 0 ? 1 : -1,
        energy: 100,
        ...(masteryTeams
          ? { masteryXp: masteryXp(masteryTeams[side], mon.id) }
          : {}),
        attributes: { ...profile.attributes },
        ...(setup.chemistryVersion === 1
          ? { chemistryProfile: structuredClone(profile) }
          : {}),
        ...(evaluation
          ? {
              roleScores: Object.fromEntries(
                POSITIONS.map((role) => [
                  role,
                  clamp(evaluatePlayer(evaluation, mon.id, role).score),
                ]),
              ) as Record<(typeof POSITIONS)[number], number>,
            }
          : {}),
        action: "idle",
        actionTime: 0,
        cooldown: 0,
        jumpTime: 0,
        charge: null,
        stats: {
          ...emptyStats(),
          ...(setup.abilityVersion === 1
            ? { abilityActivations: emptyAbilityActivations() }
            : {}),
          ...(setup.official
            ? { rimFgm: 0, rimFga: 0, midFgm: 0, midFga: 0, plusMinus: 0 }
            : {}),
        },
      });
    });
  });
  const s: ArcadeState = {
    modelVersion: 1,
    ...(masteryTeams
      ? {
          abilityMasteryVersion: 1 as const,
          masteryInitial: snapshotMastery(masteryTeams[0], masteryTeams[1]),
        }
      : {}),
    ...(setup.chemistryVersion === 1
      ? {
          chemistryVersion: 1 as const,
          chemistryContexts: setup.teams.map((team, side) => ({
            tactic: team.tactic ?? "balanced",
            defense: team.defense ?? "man",
            ...(bonds ? { bonds: bonds[side] } : {}),
            ...(moraleTeams ? { morale: moraleScores(moraleTeams[side]) } : {}),
            ...(leadership ? { leadership: leadership[side] } : {}),
            ...(team.engineRules?.familiarity === undefined
              ? {}
              : { familiarity: team.engineRules.familiarity }),
          })) as NonNullable<ArcadeState["chemistryContexts"]>,
        }
      : {}),
    ...(setup.chemistryGrowthVersion === 1
      ? {
          chemistryGrowthVersion: 1 as const,
          chemistryInitial: snapshotChemistry(
            {
              ...setup.teams[0],
              chemistryGrowthVersion: 1,
              chemistryBonds: bonds![0],
            },
            {
              ...setup.teams[1],
              chemistryGrowthVersion: 1,
              chemistryBonds: bonds![1],
            },
          ),
          chemistryMinutes: { home: {}, away: {} },
        }
      : {}),
    ...(moraleTeams
      ? {
          moraleVersion: 1 as const,
          moraleInitial: snapshotMorale(moraleTeams[0], moraleTeams[1]),
        }
      : {}),
    ...(setup.personalityVersion === 1
      ? { personalityVersion: 1 as const }
      : {}),
    ...(setup.physicalAbilityVersion === 1
      ? { physicalAbilityVersion: 1 as const }
      : {}),
    ...(setup.evaluationVersion === 1 ? { evaluationVersion: 1 as const } : {}),
    ...(setup.abilityVersion === 1
      ? {
          abilityVersion: 1 as const,
          abilityPossession: { transitionAt: null, secondChance: false },
        }
      : {}),
    ...(setup.typeMatchupsVersion === 1
      ? { typeMatchupsVersion: 1 as const }
      : {}),
    ...(setup.official
      ? { official: true, officialSeed: setup.seed >>> 0 }
      : {}),
    names: [setup.teams[0].name, setup.teams[1].name],
    players,
    phase: "tipoff",
    paused: false,
    period: 1,
    clock: 60,
    shotClock: 14,
    elapsed: 0,
    tick: 0,
    ball: {
      mode: "held",
      x: 14,
      y: 7.5,
      z: 1,
      owner: 0,
      from: null,
      target: null,
      start: { x: 14, y: 7.5, z: 1 },
      end: { x: 14, y: 7.5, z: 1 },
      travel: 0,
      duration: 1,
      shotValue: 2,
      made: false,
      dunk: false,
      lob: false,
      reboundOf: null,
      lastTouch: 0,
    },
    possession: 0,
    controlled: 0,
    passTarget: null,
    score: [0, 0],
    streak: [0, 0],
    fire: [0, 0],
    pendingSubs: [],
    events: [],
    message: "TIP OFF · Press Shoot as the ball reaches its peak",
    messageTime: 3,
    seed: setup.seed >>> 0,
    phaseTime: 0,
    openingTeam: 0,
    lastPass: null,
    pendingHorn: false,
    prevShoot: false,
    aiTimer: 0,
    tipTiming: null,
  };
  refreshArcadeChemistry(s);
  return s;
}
