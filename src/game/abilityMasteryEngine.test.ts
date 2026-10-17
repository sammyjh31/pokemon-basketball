import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { abilityImpact, type AbilityContext } from "./abilities";
import {
  physicalAbilityEffects,
  abilityEnergyChange,
} from "./physicalAbilities";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import { createGame } from "./arcade/setup";
import { stepGame } from "./arcade/engine";
import {
  createEvaluationContext,
  evaluatePlayer,
  evaluationTrainingOptions,
} from "./teamEvaluation";
import { coachTrainingPlans, validateCoachTraining } from "./coachTraining";
import { applyArcadeAbilities, changeArcadeEnergy } from "./arcade/abilities";
import { movePlayers } from "./arcade/ai";
import { giveBall, advanceBall } from "./arcade/actions";
import { NO_INPUT, type ArcadeSetup } from "./arcade/types";

const roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: 121,
  B2: 6,
  B3: 131,
};
function legacyTeams() {
  const run = { ...createRun("free", true, 22), roster };
  delete (run as { abilityMasteryVersion?: 1 }).abilityMasteryVersion;
  return createLeague(run);
}
const context: AbilityContext = {
  zone: "rim",
  play: "post",
  contested: true,
  energy: 40,
  clutch: false,
  secondChance: false,
  period: 2,
  margin: 0,
};
export const arcadeSetup = (): ArcadeSetup => ({
  seed: 42,
  abilityVersion: 1,
  physicalAbilityVersion: 1,
  evaluationVersion: 1,
  teams: [
    {
      name: "A",
      roster: { PG: 84, SG: 92, SF: 52, PF: 95, C: 113, B1: 7, B2: 8, B3: 9 },
    },
    {
      name: "B",
      roster: { PG: 20, SG: 21, SF: 22, PF: 23, C: 24, B1: 25, B2: 26, B3: 27 },
    },
  ],
});
describe("ability mastery engine", () => {
  it("pins pre-mastery current simulation and arcade replays", () => {
    const teams = legacyTeams();
    const state = createGame(arcadeSetup());
    for (let tick = 0; tick < 1000; tick++)
      stepGame(state, {
        ...NO_INPUT,
        moveX: tick % 60 < 30 ? 1 : -1,
        shoot: tick % 70 < 38,
        pass: tick % 90 === 0,
        turbo: tick % 4 === 0,
      });
    expect(
      createHash("sha256")
        .update(
          JSON.stringify({
            teams,
            match: simulateMatch(teams[0], teams[1], 42),
            state,
          }),
        )
        .digest("hex"),
    ).toBe("21130bf2eff26d4ce23a10638ee777239a45039d671d927fb30dbfc437de41e7");
  });
  it("scales only the existing shooting, support and defense deltas", () => {
    for (const [id, role, c] of [
      [68, "shooter", context],
      [130, "defender", context],
      [122, "passer", { ...context, play: "spotUp" }],
    ] as const) {
      expect(abilityImpact(id, role, c, 1000)).toBeCloseTo(
        abilityImpact(id, role, c) * 1.2,
        12,
      );
    }
    expect(
      abilityImpact(68, "shooter", { ...context, zone: "three" }, 1000),
    ).toBe(0);
  });
  it("scales every physical delta and preserves neutral effects and energy bounds", () => {
    for (const id of [84, 92, 95, 113, 143]) {
      const before = physicalAbilityEffects(id, 50),
        after = physicalAbilityEffects(id, 50, 1000);
      for (const key of Object.keys(before) as (keyof typeof before)[])
        expect(after[key]).toBeCloseTo(1 + (before[key] - 1) * 1.2, 12);
    }
    expect(abilityEnergyChange(143, 100, 4, true, 0, 1000)).toEqual({
      energy: 100,
      saved: 0,
    });
    expect(abilityEnergyChange(143, 50, -10, false, 0, 1000)).toEqual({
      energy: 40,
      saved: 0,
    });
  });
});

function masteredTeams(xp = 1000) {
  return legacyTeams().map((team) => ({
    ...team,
    abilityMasteryVersion: 1 as const,
    abilityMastery: Object.fromEntries(
      Object.values(team.roster).map((id) => [id!, xp]),
    ),
  }));
}
it("freezes match mastery and emits identical full/compact progression without mutating teams", () => {
  const [home, away] = masteredTeams(74.9);
  const frozen = { home: Array(8).fill(0), away: Array(8).fill(0) };
  const original = structuredClone([home, away]);
  const full = simulateMatch(home, away, 42, { mastery: frozen });
  const compact = simulateMatch(home, away, 42, {
    mastery: frozen,
    collectInsights: false,
  });
  expect(full.masteryReport).toBeDefined();
  expect(full.masteryReport).toEqual(compact.masteryReport);
  expect(full.masteryReport!.home.every((row) => row.before === 0)).toBe(true);
  expect(full.homeBox).toEqual(compact.homeBox);
  expect([home, away]).toEqual(original);
  expect(() =>
    simulateMatch(home, { ...away, abilityMasteryVersion: undefined }, 42),
  ).toThrow(/mastery/);
  expect(() =>
    simulateMatch(home, away, 42, {
      mastery: { home: [0], away: frozen.away },
    }),
  ).toThrow();
});
it("values mastery only when the ability is enabled and respects recovery in automatic practice", () => {
  const team = {
    ...masteredTeams(0)[0],
    coach: { version: 1 as const, id: "misty" },
  };
  const mastered = {
    ...team,
    abilityMastery: Object.fromEntries(
      Object.values(team.roster).map((id) => [id!, 1000]),
    ),
  };
  const before = evaluatePlayer(createEvaluationContext(team), 68),
    after = evaluatePlayer(createEvaluationContext(mastered), 68);
  expect(after.score).toBeGreaterThan(before.score);
  expect(after.talent).toBe(before.talent);
  const disabled = {
    ...mastered,
    engineRules: { ...mastered.engineRules!, abilities: false },
  };
  expect(
    evaluatePlayer(createEvaluationContext(disabled), 68)
      .factors.filter((f) => ["ability", "physical"].includes(f.key))
      .every((f) => f.contribution === 0),
  ).toBe(true);
  const options = evaluationTrainingOptions(team, 68);
  const legacyOptions = evaluationTrainingOptions(
    { ...team, abilityMasteryVersion: undefined },
    68,
  );
  expect(
    options.some(
      (option) =>
        option.gain >
        legacyOptions.find((old) => old.focus === option.focus)!.gain,
    ),
  ).toBe(true);
  const plans = coachTrainingPlans(team);
  for (const plan of Object.values(plans))
    expect(validateCoachTraining(plan, "misty")).toEqual(plan);
  expect(
    Object.values(plans).every((p) => p.reasons.join(" ").includes("mastery")),
  ).toBe(true);
  const heavy = Object.values(team.roster).map((id) => ({
    teamId: team.id,
    pokemonId: id,
    gamesPlayed: 10,
    minutes: 400,
  }));
  expect(
    Object.values(coachTrainingPlans(team, heavy as never)).every(
      (p) => p.plan.intensity === "steady",
    ),
  ).toBe(true);
});
it("freezes arcade XP, applies actual shot and movement deltas, and masks legacy team flags", () => {
  const source = arcadeSetup();
  source.teams = source.teams.map((team) => ({
    ...team,
    abilityMasteryVersion: 1,
    abilityMastery: Object.fromEntries(
      Object.values(team.roster).map((id) => [id!, 1000]),
    ),
  })) as ArcadeSetup["teams"];
  const legacy = createGame(source),
    state = createGame({ ...source, abilityMasteryVersion: 1 });
  expect(legacy).not.toHaveProperty("masteryInitial");
  expect(legacy.players[0]).not.toHaveProperty("masteryXp");
  expect(state.masteryInitial).toEqual({
    home: Array(8).fill(1000),
    away: Array(8).fill(1000),
  });
  source.teams[0].abilityMastery![84] = 0;
  expect(state.players[0].masteryXp).toBe(1000);
  for (const current of [state, legacy]) {
    current.phase = "live";
    current.players.forEach((p) => {
      p.x = 2 + (p.id % 8) * 3;
      p.y = p.team === 0 ? 2 : 13;
    });
    current.players[0].x = 10;
    current.players[0].y = 7.5;
    giveBall(current, current.players[0]);
    movePlayers(current, { ...NO_INPUT, moveX: 1 }, 1 / 60);
  }
  expect(state.players[0].x).toBeGreaterThan(legacy.players[0].x);
  expect(state.seed).toBe(legacy.seed);
  expect(state.players[0].attributes).toEqual(legacy.players[0].attributes);
  for (const current of [state, legacy]) {
    current.players[0].pokemonId = 68;
    current.players[0].energy = 50;
  }
  expect(
    applyArcadeAbilities(state, state.players[0], undefined, "rim", 0.5),
  ).toBeCloseTo(0.524);
  expect(
    applyArcadeAbilities(legacy, legacy.players[0], undefined, "rim", 0.5),
  ).toBeCloseTo(0.52);
  const before = structuredClone(state.masteryInitial);
  changeArcadeEnergy(state, state.players[4], -20);
  expect(state.masteryInitial).toEqual(before);
  expect(() =>
    createGame({
      ...source,
      abilityMasteryVersion: 1,
      abilityVersion: undefined,
    }),
  ).toThrow();
  source.teams[1].abilityMasteryVersion = undefined;
  expect(() => createGame({ ...source, abilityMasteryVersion: 1 })).toThrow();
});

function arcadeMasteryScenario(xp: number) {
  const setup = arcadeSetup();
  setup.teams = setup.teams.map((team) => ({
    ...team,
    abilityMasteryVersion: 1,
    abilityMastery: Object.fromEntries(
      Object.values(team.roster).map((id) => [id!, xp]),
    ),
  })) as ArcadeSetup["teams"];
  const state = createGame({ ...setup, abilityMasteryVersion: 1 });
  state.phase = "live";
  for (const p of state.players) {
    p.x = 2 + (p.id % 8) * 3;
    p.y = p.team === 0 ? 2 : 13;
    for (const key of Object.keys(
      p.attributes,
    ) as (keyof typeof p.attributes)[])
      p.attributes[key] = 50;
  }
  state.players[0].x = 10;
  state.players[0].y = 7.5;
  giveBall(state, state.players[0]);
  return state;
}
it("uses mastered screens and navigation in actual contact without duplicate activation credit", () => {
  for (const navigation of [false, true]) {
    const ordinary = arcadeMasteryScenario(0),
      mastered = arcadeMasteryScenario(1000);
    for (const state of [ordinary, mastered]) {
      const actor = state.players[navigation ? 0 : 3],
        opponent = state.players[8];
      actor.x = 12;
      actor.y = 7.5;
      opponent.x = 12.5;
      opponent.y = 7.5;
      if (navigation) {
        actor.pokemonId = 96;
        opponent.pokemonId = 1;
        opponent.action = "screen";
        opponent.actionTime = 1;
      } else {
        actor.action = "screen";
        actor.actionTime = 1;
      }
      movePlayers(state, NO_INPUT, 1 / 60);
    }
    const index = navigation ? 0 : 3;
    expect(mastered.players[index].x).toBeGreaterThan(
      ordinary.players[index].x,
    );
    expect(
      mastered.players[index].stats.abilityActivations!.physical!.screens,
    ).toBe(1);
    movePlayers(mastered, NO_INPUT, 1 / 60);
    expect(
      mastered.players[index].stats.abilityActivations!.physical!.screens,
    ).toBe(1);
    expect(mastered.seed).toBe(ordinary.seed);
  }
});
it("resolves a close rebound differently from mastery and records actual energy savings at caps", () => {
  const ordinary = arcadeMasteryScenario(0),
    mastered = arcadeMasteryScenario(1000);
  for (const state of [ordinary, mastered]) {
    state.players[2].x = 14.653;
    state.players[2].y = 7.5;
    state.players[8].x = 13.36;
    state.players[8].y = 7.5;
    Object.assign(state.ball, {
      mode: "loose",
      owner: null,
      x: 14,
      y: 7.5,
      z: 0,
      reboundOf: 0,
    });
    advanceBall(state, 1 / 60);
    const player = state.players[4];
    player.energy = 50;
    changeArcadeEnergy(state, player, -10);
  }
  expect(ordinary.ball.owner).toBe(8);
  expect(mastered.ball.owner).toBe(2);
  expect(mastered.players[4].energy).toBeCloseTo(42.16);
  expect(ordinary.players[4].energy).toBeCloseTo(41.8);
  const player = mastered.players[4],
    previous = player.stats.abilityActivations!.physical!.energySaved;
  player.energy = 100;
  changeArcadeEnergy(mastered, player, 10);
  expect(player.stats.abilityActivations!.physical!.energySaved).toBe(previous);
  player.energy = 50;
  changeArcadeEnergy(mastered, player, 10);
  expect(player.energy).toBeCloseTo(62.16);
});
it("keeps mastery dormant when simulated and arcade abilities are disabled", () => {
  const teams = masteredTeams(1000).map((team) => ({
    ...team,
    engineRules: {
      version: 1 as const,
      familiarity: 0,
      adaptiveCoaching: false,
      ...team.engineRules,
      abilities: false,
    },
  }));
  const game = simulateMatch(teams[0], teams[1], 42);
  expect(
    [...game.homeBox, ...game.awayBox].every((p) => !p.abilityActivations),
  ).toBe(true);
  expect(
    [...game.masteryReport!.home, ...game.masteryReport!.away].every(
      (p) => p.gained === 0,
    ),
  ).toBe(true);
  const source = arcadeSetup();
  source.teams.forEach((team) => {
    team.abilityMasteryVersion = 1;
    team.abilityMastery = Object.fromEntries(
      Object.values(team.roster).map((id) => [id!, 1000]),
    );
  });
  const disabled = createGame({ ...source, abilityVersion: undefined });
  const plain = createGame({ ...arcadeSetup(), abilityVersion: undefined });
  for (const state of [disabled, plain]) {
    state.phase = "live";
    movePlayers(state, { ...NO_INPUT, moveX: 1, turbo: true }, 1 / 60);
  }
  expect(disabled).toEqual(plain);
});
it("preserves frozen mastery for official teams whose league disables abilities", () => {
  const setup = arcadeSetup();
  setup.teams = setup.teams.map((team) => ({
    ...team,
    abilityVersion: 1,
    abilityMasteryVersion: 1,
    abilityMastery: Object.fromEntries(
      Object.values(team.roster).map((id) => [id!, 400]),
    ),
    engineRules: { abilities: false },
  })) as ArcadeSetup["teams"];
  const state = createGame({
    ...setup,
    abilityVersion: undefined,
    abilityMasteryVersion: 1,
  });
  expect(state.masteryInitial).toEqual({
    home: Array(8).fill(400),
    away: Array(8).fill(400),
  });
  expect(state.abilityVersion).toBeUndefined();
  expect(state.players.every((p) => !p.stats.abilityActivations)).toBe(true);
  expect(
    applyArcadeAbilities(state, state.players[0], undefined, "rim", 0.5),
  ).toBe(0.5);
  setup.teams[1].engineRules!.abilities = true;
  expect(() =>
    createGame({
      ...setup,
      abilityVersion: undefined,
      abilityMasteryVersion: 1,
    }),
  ).toThrow();
});
it("changes simulated action resolution while matching activation counts to applied shot effects", () => {
  const ordinary = masteredTeams(0),
    mastered = masteredTeams(1000);
  const before = simulateMatch(ordinary[0], ordinary[1], 428);
  const after = simulateMatch(mastered[0], mastered[1], 428);
  expect(after.insights!.shots.map((s) => s.expectedProbability)).not.toEqual(
    before.insights!.shots.map((s) => s.expectedProbability),
  );
  const effects = after.insights!.shots.flatMap((s) => s.abilityEffects ?? []);
  expect(
    effects.some((effect) => Math.abs(effect.probabilityDelta) > 0.025),
  ).toBe(true);
  for (const box of [...after.homeBox, ...after.awayBox]) {
    const recorded = box.abilityActivations!;
    expect(recorded.offense + recorded.support + recorded.defense).toBe(
      effects.filter((e) => e.playerId === box.playerId).length,
    );
  }
  for (const teams of [ordinary, mastered])
    teams.forEach((team) => {
      team.engineRules = {
        version: 1,
        abilities: false,
        adaptiveCoaching: false,
        familiarity: 0,
      };
    });
  const offBefore = simulateMatch(ordinary[0], ordinary[1], 428),
    offAfter = simulateMatch(mastered[0], mastered[1], 428);
  expect(offBefore.homeBox).toEqual(offAfter.homeBox);
  expect(offBefore.awayBox).toEqual(offAfter.awayBox);
});
