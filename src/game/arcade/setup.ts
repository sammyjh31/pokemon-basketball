import { POKEMON_BY_ID } from "../../data/pokemon";
import { playerProfile } from "../playerProfile";
import { emptyAbilityActivations } from "../abilities";
import { clamp } from "../ratings";
import { createEvaluationContext, evaluatePlayer } from "../teamEvaluation";
import { POSITIONS, ROSTER_SLOTS } from "../types";
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
    (setup.abilityVersion !== undefined && setup.abilityVersion !== 1) ||
    (setup.physicalAbilityVersion !== undefined &&
      setup.physicalAbilityVersion !== 1) ||
    (setup.evaluationVersion !== undefined && setup.evaluationVersion !== 1)
  )
    throw new Error("Choose two complete teams to play.");
  setup.teams.forEach((team, side) => {
    const evaluation =
      setup.evaluationVersion === 1
        ? createEvaluationContext({
            ...team,
            tactic: team.tactic ?? "balanced",
            // Evaluate the abilities actually active on this court.
            abilityVersion: setup.abilityVersion,
            physicalAbilityVersion: setup.physicalAbilityVersion,
            engineRules: { abilities: setup.abilityVersion === 1 },
          })
        : undefined;
    ROSTER_SLOTS.forEach((slot, i) => {
      const id = team.roster[slot],
        mon = id == null ? undefined : POKEMON_BY_ID.get(id);
      if (!mon || used.has(mon.id))
        throw new Error("Both teams need eight distinct Pokémon.");
      used.add(mon.id);
      const profile = playerProfile(mon, team.development?.[mon.id]);
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
        attributes: { ...profile.attributes },
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
  return s;
}
