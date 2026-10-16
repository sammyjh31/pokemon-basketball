import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { leaguePlayers } from "./leagueStats";
import { simulateMatch } from "./match";
import { rotationMinutes, teamRatings } from "./ratings";
import { developPlayer } from "./development";
import { DEVELOPMENT_SKILLS } from "./developmentTypes";
import type { PlayerTrainingPlan, RotationPlan } from "./franchiseFeatures";
import {
  POSITIONS,
  type LeaguePlayer,
  type LeagueTeam,
  type Roster,
} from "./types";

const roster: Roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: 121,
  B2: 6,
  B3: 131,
};
const plan = (): RotationPlan => ({
  minutes: { PG: 40, SG: 40, SF: 40, PF: 40, C: 40, B1: 20, B2: 20, B3: 0 },
  closing: [...POSITIONS],
});
const team = (id: number, rotationPlan?: RotationPlan): LeagueTeam => ({
  id,
  name: `Team ${id}`,
  roster,
  tactic: "balanced",
  rotation: "balanced",
  defense: "man",
  ratings: teamRatings(roster),
  ...(rotationPlan ? { rotationPlan } : {}),
});
const player = (): LeaguePlayer => ({
  ...leaguePlayers(createLeague({ ...createRun("free", true, 47), roster }))[0],
  gamesPlayed: 82,
  minutes: 2460,
  points: 1800,
  assists: 500,
  offensiveRebounds: 50,
  defensiveRebounds: 350,
  steals: 100,
  blocks: 30,
  turnovers: 180,
  fga: 1400,
  fgm: 650,
  ftm: 300,
  fta: 360,
  threePM: 200,
  threePA: 520,
  rimFga: 500,
  rimFgm: 290,
  midFga: 380,
  midFgm: 160,
});

describe("custom rotations", () => {
  it("uses all custom targets for ratings and keeps a zero-minute reserve out of games", () => {
    const custom = plan();
    expect(rotationMinutes(roster, "balanced", undefined, custom)).toEqual(
      custom.minutes,
    );
    expect(
      teamRatings(roster, "balanced", "balanced", undefined, custom),
    ).not.toEqual(teamRatings(roster));
    const game = simulateMatch(team(0, custom), team(1), 12345);
    expect(game.homeBox.find((p) => p.slot === "B3")!.minutes).toBe(0);
    expect(game.homeBox.reduce((sum, p) => sum + p.minutes, 0)).toBe(
      240 + game.overtimePeriods * 25,
    );
  });

  it("replaces a zero-minute starter and records the five players who actually start", () => {
    const custom = plan();
    custom.minutes.PG = 0;
    custom.minutes.B1 = 40;
    custom.minutes.B2 = 40;
    custom.closing = ["B1", "SG", "SF", "PF", "C"];
    const game = simulateMatch(team(0, custom), team(1), 12345);
    expect(game.homeBox.find((p) => p.slot === "PG")).toMatchObject({
      minutes: 0,
      started: false,
    });
    expect(game.homeBox.filter((p) => p.started)).toHaveLength(5);
    expect(
      game.homeBox.filter((p) => p.started).every((p) => p.minutes > 0),
    ).toBe(true);
  });

  it("changes cached targets when a custom plan is edited and preserves prior replays", async () => {
    const home = team(0, plan()),
      away = team(1);
    const original = structuredClone(home);
    const before = simulateMatch(home, away, 761);
    home.rotationPlan!.minutes.B1 = 0;
    home.rotationPlan!.minutes.B3 = 20;
    const warmed = simulateMatch(home, away, 761);
    expect(warmed.homeBox.find((p) => p.slot === "B1")!.minutes).toBe(0);
    expect(warmed).not.toEqual(before);
    expect(simulateMatch(original, away, 761)).toEqual(before);
    vi.resetModules();
    const fresh = await import("./match");
    expect(warmed).toEqual(fresh.simulateMatch(home, away, 761));
  });

  it("gives a selected low-minute closer a real closing shift", () => {
    const custom: RotationPlan = {
      minutes: { PG: 44, SG: 40, SF: 40, PF: 40, C: 40, B1: 1, B2: 35, B3: 0 },
      closing: [...POSITIONS],
    };
    let closingMinutes = 0,
      ordinaryMinutes = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const ordinary = simulateMatch(team(0, custom), team(1), seed);
      const closer = simulateMatch(
        team(0, { ...custom, closing: ["B1", "SG", "SF", "PF", "C"] }),
        team(1),
        seed,
      );
      ordinaryMinutes += ordinary.homeBox.find((p) => p.slot === "B1")!.minutes;
      closingMinutes += closer.homeBox.find((p) => p.slot === "B1")!.minutes;
    }
    expect(closingMinutes).toBeGreaterThan(ordinaryMinutes + 15);
  });
});

describe("individual training", () => {
  it("preserves the legacy report exactly for absent or balanced standard plans", () => {
    const baseline = developPlayer(player(), {}, 1, 471);
    expect(
      developPlayer(player(), {}, 1, 471, {
        focus: "balanced",
        intensity: "standard",
      }),
    ).toEqual(baseline);
    expect(
      createHash("sha256").update(JSON.stringify(baseline)).digest("hex"),
    ).toMatchInlineSnapshot(
      `"e1dac7d87c5b7515e92590720f5c48c7447ec9716c891acd2907d82ba5b6c36f"`,
    );
  });

  it("trades general gains for the selected skills and explains the training focus", () => {
    const p = player();
    let shootingGain = 0,
      otherGain = 0;
    for (let seed = 0; seed < 30; seed++) {
      const baseline = developPlayer(p, {}, 1, seed);
      const focused = developPlayer(p, {}, 1, seed, {
        focus: "shooting",
        intensity: "standard",
      });
      shootingGain +=
        (focused.changes.threePoint ?? 0) - (baseline.changes.threePoint ?? 0);
      otherGain += (focused.changes.block ?? 0) - (baseline.changes.block ?? 0);
      expect(focused.reasons.some((r) => /shooting/i.test(r))).toBe(true);
    }
    expect(shootingGain).toBeGreaterThan(35);
    expect(otherGain).toBeLessThan(-10);
  });

  it("adapts position practice to the target role", () => {
    const p = player();
    let guardPassing = 0,
      centerPassing = 0,
      guardBlock = 0,
      centerBlock = 0;
    for (let seed = 0; seed < 20; seed++) {
      const guard = developPlayer(p, {}, 1, seed, {
        focus: "position",
        intensity: "standard",
        position: "PG",
      });
      const center = developPlayer(p, {}, 1, seed, {
        focus: "position",
        intensity: "standard",
        position: "C",
      });
      guardPassing += guard.changes.passing ?? 0;
      centerPassing += center.changes.passing ?? 0;
      guardBlock += guard.changes.block ?? 0;
      centerBlock += center.changes.block ?? 0;
    }
    expect(guardPassing).toBeGreaterThan(centerPassing + 20);
    expect(centerBlock).toBeGreaterThan(guardBlock + 20);
  });

  it("makes aggressive work more volatile while preserving annual and cumulative bounds", () => {
    const p = player();
    const movement = (intensity: PlayerTrainingPlan["intensity"]) =>
      Array.from(
        { length: 50 },
        (_, seed) =>
          developPlayer(p, {}, 1, seed, { focus: "balanced", intensity })
            .after -
          developPlayer(p, {}, 1, seed, { focus: "balanced", intensity })
            .before,
      );
    const variance = (values: number[]) => {
      const mean = values.reduce((sum, n) => sum + n, 0) / values.length;
      return (
        values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / values.length
      );
    };
    expect(variance(movement("aggressive"))).toBeGreaterThan(
      variance(movement("steady")) * 1.5,
    );
    for (const offset of [-30, 0, 30])
      for (let seed = 0; seed < 20; seed++) {
        const previous = Object.fromEntries(
          DEVELOPMENT_SKILLS.map((skill) => [skill, offset]),
        );
        const report = developPlayer(p, previous, 5, seed, {
          focus: "conditioning",
          intensity: "aggressive",
        });
        expect(
          report.reasons.some((r) => /risk|volatile|volatility/i.test(r)),
        ).toBe(true);
        for (const skill of DEVELOPMENT_SKILLS) {
          const change = report.changes[skill] ?? 0;
          expect(Number.isInteger(change)).toBe(true);
          expect(change).toBeGreaterThanOrEqual(-10);
          expect(change).toBeLessThanOrEqual(12);
          expect(offset + change).toBeGreaterThanOrEqual(-30);
          expect(offset + change).toBeLessThanOrEqual(30);
        }
      }
  });
});
