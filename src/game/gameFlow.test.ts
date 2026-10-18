import { describe, expect, it } from "vitest";
import {
  arenaCondition,
  eliminationGame,
  fieldAbilityBonus,
  fieldEffects,
  floorCondition,
  gameDay,
  playoffFlow,
  playoffTargets,
  refereeCrew,
  restTargets,
  scheduleFlow,
  seriesAdjustment,
  startingEnergy,
  timeoutDecision,
  validateGameFlowFixture,
  type TimeoutState,
} from "./gameFlow";
import { leagueSchedule } from "./league";
import { localSchedule } from "./localSeason";
import { POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { speciesAbility } from "./abilities";

const byAbility = (id: string) =>
  [...POKEMON_BY_ID.values()].find((mon) => speciesAbility(mon.id).id === id)!
    .id;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("schedule rest", () => {
  const fixtures = leagueSchedule(77);
  const flows = scheduleFlow(fixtures);
  it("assigns every fixture a day inside its round window", () => {
    for (const f of fixtures)
      expect([f.round * 2, f.round * 2 + 1]).toContain(gameDay(f));
  });
  it("produces a realistic number of back-to-backs per team", () => {
    const backToBacks = new Map<number, number>();
    for (const f of fixtures) {
      const flow = flows.get(f.id)!;
      for (const [id, rest] of [
        [f.homeTeamId, flow.rest.home],
        [f.awayTeamId, flow.rest.away],
      ])
        if (rest === 0) backToBacks.set(id, (backToBacks.get(id) ?? 0) + 1);
    }
    const counts = [...backToBacks.values()];
    expect(counts).toHaveLength(30);
    const mean = sum(counts) / 30;
    expect(mean).toBeGreaterThan(10);
    expect(mean).toBeLessThan(18);
  });
  it("starts rested and tracks road trips", () => {
    const first = fixtures.filter((f) => f.round === 0);
    for (const f of first) expect(flows.get(f.id)!.rest).toEqual({ home: 3, away: 3 });
    for (const f of fixtures) {
      const flow = flows.get(f.id)!;
      expect(flow.trip.home).toBe(0);
      expect(flow.trip.away).toBeGreaterThanOrEqual(1);
      expect(flow.trip.away).toBeLessThanOrEqual(6);
      expect(validateGameFlowFixture(flow)).toEqual(flow);
    }
  });
  it("is a pure function of the schedule", () => {
    expect([...scheduleFlow(leagueSchedule(77))]).toEqual([...flows]);
    const local = localSchedule(
      { teamCount: 8, gamesPerTeam: 28, playoffTeams: 4, bestOf: 5 },
      9,
    );
    expect(scheduleFlow(local).size).toBe(local.length);
  });
});

describe("playoff context", () => {
  const series = {
    round: 2,
    higherSeedId: 4,
    higherSeedWins: 3,
    lowerSeedWins: 2,
    games: [
      { homeTeamId: 9, awayTeamId: 4, homeScore: 101, awayScore: 99 },
    ],
  };
  it("records series state from the home team's perspective", () => {
    const flow = playoffFlow(series, 9, 7);
    expect(flow.playoff).toEqual({
      round: 2,
      game: 2,
      homeWins: 2,
      awayWins: 3,
      winsNeeded: 4,
      previous: { winnerId: 9, margin: 2 },
    });
    expect(eliminationGame(flow)).toEqual({ home: true, away: false });
  });
  it("rejects impossible series records", () => {
    const flow = playoffFlow(series, 9, 7);
    expect(() =>
      validateGameFlowFixture({
        ...flow,
        playoff: { ...flow.playoff!, homeWins: 4 },
      }),
    ).toThrow();
    expect(() =>
      validateGameFlowFixture({ ...flow, playoff: undefined }),
    ).toThrow();
    expect(() =>
      validateGameFlowFixture({ ...flow, rest: { home: -1, away: 1 } }),
    ).toThrow();
  });
  it("treats single elimination as an elimination game for both teams", () => {
    const flow = playoffFlow(
      { round: 0, higherSeedId: 1, higherSeedWins: 0, lowerSeedWins: 0, games: [] },
      1,
      1,
    );
    expect(validateGameFlowFixture(flow)).toEqual(flow);
    expect(eliminationGame(flow)).toEqual({ home: true, away: true });
  });
});

describe("referees", () => {
  it("draws a stable crew mix without a simulation stream", () => {
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 5000; seed++) {
      const crew = refereeCrew(seed * 2654435761, "regular");
      expect(refereeCrew(seed * 2654435761, "regular")).toBe(crew);
      counts.set(crew.id, (counts.get(crew.id) ?? 0) + 1);
    }
    expect(counts.get("standard")! / 5000).toBeGreaterThan(0.3);
    expect(counts.get("standard")! / 5000).toBeLessThan(0.42);
    expect(counts.get("letThemPlay")! / 5000).toBeGreaterThan(0.08);
  });
  it("loosens playoff whistles by one step", () => {
    for (let seed = 1; seed < 200; seed++) {
      const regular = refereeCrew(seed, "regular").tightness,
        playoff = refereeCrew(seed, "playoff").tightness;
      expect(playoff).toBe(Math.max(-1, regular - 0.5));
    }
  });
});

describe("arenas and field conditions", () => {
  const roster = (ids: number[]) =>
    Object.fromEntries(
      ["PG", "SG", "SF", "PF", "C", "B1", "B2", "B3"].map((slot, i) => [
        slot,
        ids[i],
      ]),
    ) as never;
  it("themes CPU arenas by club identity", () => {
    expect(arenaCondition({ id: 4, roster: roster([]) })).toBe("rain");
    expect(arenaCondition({ id: 10, roster: roster([]) })).toBe("sun");
    expect(arenaCondition({ id: 1, roster: roster([]) })).toBe("neutral");
  });
  it("follows club 0's roster when three players share a weather type", () => {
    const water = POKEMON.filter((m) => m.types.includes("water")).slice(0, 3);
    const normal = POKEMON.filter(
      (m) => m.types.length === 1 && m.types[0] === "normal",
    ).slice(0, 5);
    expect(
      arenaCondition({ id: 0, roster: roster([...water, ...normal].map((m) => m.id)) }),
    ).toBe("rain");
    expect(
      arenaCondition({
        id: 0,
        roster: roster([...water.slice(0, 2), ...normal, normal[0]].map((m) => m.id)),
      }),
    ).toBe("neutral");
  });
  it("lets setters override the arena, home first", () => {
    const drizzle = byAbility("drizzle"),
      drought = byAbility("drought");
    expect(floorCondition("snow", [drizzle], [drought])).toBe("rain");
    expect(floorCondition("snow", [1], [drought])).toBe("sun");
    expect(floorCondition("snow", [1], [4])).toBe("snow");
  });
  it("strengthens weather abilities only in matching conditions", () => {
    const swim = byAbility("swift-swim");
    const transition = {
      zone: "rim" as const,
      play: "transition",
      contested: false,
      energy: 90,
    };
    expect(fieldAbilityBonus(swim, "shooter", transition, "rain")).toBeCloseTo(0.01);
    expect(fieldAbilityBonus(swim, "shooter", transition, "sun")).toBe(0);
    expect(fieldEffects(swim, ["water"], "rain", true).movement).toBeCloseTo(1.12 / 1.08);
    expect(fieldEffects(swim, ["water"], "rain", false).movement).toBe(1);
  });
  it("changes energy drain, never accuracy, for type comfort", () => {
    expect(fieldEffects(1, ["fire"], "rain", false)).toEqual({ movement: 1, drain: 1.04 });
    expect(fieldEffects(1, ["water"], "rain", false)).toEqual({ movement: 1, drain: 0.95 });
    expect(fieldEffects(1, ["normal"], "neutral", true)).toEqual({ movement: 1, drain: 1 });
  });
});

describe("rotation targets", () => {
  const base = [34, 33, 32, 31, 30, 28, 30, 22];
  it("tightens playoff rotations while keeping 240 minutes", () => {
    const next = playoffTargets(base, 0.2, false);
    expect(sum(next)).toBe(240);
    expect(next[7]).toBeLessThan(base[7]);
    expect(Math.max(...next)).toBeLessThanOrEqual(42);
    expect(next[0]).toBeGreaterThan(base[0]);
    const deep = playoffTargets(base, 0.9, false);
    expect(deep[7]).toBeGreaterThan(next[7]);
    const elimination = playoffTargets(base, 0.2, true);
    expect(elimination[7]).toBeLessThan(next[7]);
  });
  it("moves starter minutes to the bench on a managed back-to-back", () => {
    const next = restTargets(base, 0.8);
    expect(sum(next)).toBe(240);
    expect(next[0]).toBeLessThan(base[0]);
    expect(next[7]).toBeGreaterThan(base[7]);
    expect(Math.max(...next)).toBeLessThanOrEqual(40);
  });
  it("starts tired players below full energy", () => {
    expect(startingEnergy(34, 60, 2, 1)).toBe(100);
    const tired = startingEnergy(34, 60, 0, 1);
    expect(tired).toBeLessThan(94);
    expect(tired).toBeGreaterThan(92);
    expect(startingEnergy(10, 60, 0, 1)).toBeGreaterThan(tired);
    expect(startingEnergy(34, 90, 0, 1)).toBeGreaterThan(tired);
    expect(startingEnergy(34, 60, 3, 6)).toBe(98.5);
  });
});

describe("timeouts", () => {
  const state: TimeoutState = {
    period: 1,
    remaining: 400,
    untilWindow: 40,
    margin: -4,
    run: 0,
    energy: 80,
    left: 6,
    fourthUsed: 0,
    restUsedThisPeriod: false,
    lateUsedThisPeriod: false,
  };
  const coach = { adaptability: 0.5, rest: 0.5 };
  it("stops runs sooner for adaptive coaches", () => {
    expect(timeoutDecision(coach, { ...state, run: 8 })).toBe("run");
    expect(timeoutDecision(coach, { ...state, run: 7 })).toBeUndefined();
    expect(timeoutDecision({ ...coach, adaptability: 1 }, { ...state, run: 6 })).toBe("run");
  });
  it("keeps a reserve for the final stretch", () => {
    expect(timeoutDecision(coach, { ...state, run: 12, left: 2 })).toBeUndefined();
    expect(
      timeoutDecision(coach, { ...state, period: 3, remaining: 150, run: 12, left: 2 }),
    ).toBe("run");
  });
  it("calls rest and late-game timeouts", () => {
    expect(timeoutDecision(coach, { ...state, energy: 55 })).toBe("rest");
    expect(
      timeoutDecision(coach, { ...state, energy: 55, restUsedThisPeriod: true }),
    ).toBeUndefined();
    expect(
      timeoutDecision(coach, { ...state, period: 3, remaining: 20, margin: -2 }),
    ).toBe("late");
    expect(
      timeoutDecision(coach, { ...state, period: 3, remaining: 20, margin: 2 }),
    ).toBeUndefined();
    expect(
      timeoutDecision(coach, { ...state, period: 3, remaining: 20, margin: -2, left: 0 }),
    ).toBeUndefined();
  });
});

describe("series adjustments", () => {
  const plan = { tactic: "balanced" as const, defense: "man" as const };
  const flow = playoffFlow(
    {
      round: 0,
      higherSeedId: 1,
      higherSeedWins: 0,
      lowerSeedWins: 1,
      games: [{ homeTeamId: 1, awayTeamId: 2, homeScore: 90, awayScore: 108 }],
    },
    1,
    7,
  );
  const history = {
    games: 3,
    possessions: 300,
    pickRolls: 40,
    switches: 10,
    helpRotations: 12,
    players: { 5: { attempts: 40, points: 50, rimAttempts: 6, threeAttempts: 22 } },
  };
  it("re-plans after a loss from scouting evidence", () => {
    const next = seriesAdjustment(plan, { adaptability: 0.7 }, 1, flow, history, () => "perimeter");
    expect(next.defense).toBe("switch");
    expect(next.tactic).toBe("perimeter");
    expect(next.note).toMatch(/Lost the last game/);
  });
  it("keeps the plan after a win or for a rigid coach", () => {
    expect(seriesAdjustment(plan, { adaptability: 0.7 }, 2, flow, history, () => "pace")).toBe(plan);
    expect(seriesAdjustment(plan, { adaptability: 0.3 }, 1, flow, history, () => "pace")).toBe(plan);
  });
});
