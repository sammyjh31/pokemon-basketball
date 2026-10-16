import { expect, it } from "vitest";
import { resolveRebound } from "./possessionModel";
import { simulateMatch } from "./match";
import { teamRatings } from "./ratings";
import { ROSTER_SLOTS, type LeagueTeam, type Roster } from "./types";
const roster = Object.fromEntries(
  ROSTER_SLOTS.map((s, i) => [s, [65, 135, 149, 68, 143, 121, 6, 131][i]]),
) as Roster;
const team = (id: number): LeagueTeam => ({
  id,
  name: String(id),
  roster,
  tactic: "balanced",
  rotation: "balanced",
  defense: "man",
  ratings: teamRatings(roster),
  simulationVersion: 2,
  possessionVersion: 1,
});
const players = Array.from({ length: 5 }, (_, i) => ({
  id: String(i),
  offense: 65,
  defense: 65,
  strength: 65,
  vertical: 65,
  speed: 65,
  passing: 65,
  discipline: 65,
}));
it("interior commitment raises rebound chance but exposes the break; long misses favor speed", () => {
  const interior = resolveRebound(
    players,
    players,
    { zone: "rim", tactic: "interior", defenseTactic: "balanced" },
    () => 0.9,
  );
  const safe = resolveRebound(
    players,
    players,
    { zone: "rim", tactic: "defense", defenseTactic: "balanced" },
    () => 0.9,
  );
  expect(interior.offensiveChance).toBeGreaterThan(safe.offensiveChance);
  expect(interior.transitionEdge).toBeGreaterThan(safe.transitionEdge);
  const quick = players.map((p, i) => ({
    ...p,
    speed: i === 0 ? 99 : 20,
    strength: i === 0 ? 20 : 99,
  }));
  const long = resolveRebound(
    quick,
    players,
    { zone: "three", tactic: "interior", defenseTactic: "balanced" },
    () => 0.9,
  );
  const short = resolveRebound(
    quick,
    players,
    { zone: "rim", tactic: "interior", defenseTactic: "balanced" },
    () => 0.9,
  );
  expect(long.attackWeights[0] / long.attackWeights[1]).toBeGreaterThan(
    short.attackWeights[0] / short.attackWeights[1],
  );
});
it("records created shots, scoring phases and rebound events with exact basketball accounting", () => {
  let opportunities = 0,
    second = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const h = team(0),
      a = team(1);
    const before = JSON.stringify([h, a]);
    const m = simulateMatch(h, a, seed);
    const p = m.insights!.possession!;
    expect(p).toBeDefined();
    expect(JSON.stringify([h, a])).toBe(before);
    expect(m).toEqual(simulateMatch(h, a, seed));
    const compact = simulateMatch(h, a, seed, { collectInsights: false });
    expect({ ...m, insights: undefined }).toEqual(compact);
    for (const [id, boxes, points] of [
      [0, m.homeBox, m.homeScore],
      [1, m.awayBox, m.awayScore],
    ] as const) {
      const t = p.teams.find((t) => t.teamId === id)!;
      expect(t.points).toBe(points);
      expect(boxes.reduce((n, b) => n + 2 * b.fgm + b.threePM + b.ftm, 0)).toBe(
        points,
      );
      expect(boxes.reduce((n, b) => n + b.minutes, 0)).toBe(
        240 + 25 * m.overtimePeriods,
      );
      expect(t.secondChancePoints).toBeLessThanOrEqual(points);
      expect(t.transitionPoints).toBeLessThanOrEqual(points);
      second += t.secondChancePoints;
      for (const b of boxes) {
        const row = p.players.find((r) => r.playerId === b.playerId)!;
        expect(row.assists).toBe(b.assists);
        expect(row.potentialAssists).toBeGreaterThanOrEqual(b.assists);
        expect(row.assistPoints).toBeGreaterThanOrEqual(b.assists * 2);
        expect(row.assistPoints).toBeLessThanOrEqual(b.assists * 3);
        expect(row.offensiveRebounds).toBe(b.offensiveRebounds);
        expect(row.defensiveRebounds).toBe(b.defensiveRebounds);
        expect(row.reboundChances).toBeGreaterThanOrEqual(
          b.offensiveRebounds + b.defensiveRebounds,
        );
        opportunities += row.potentialAssists;
      }
    }
    for (const shot of m.insights!.shots) {
      if (shot.creatorId) expect(shot.creatorId).not.toBe(shot.shooterId);
      if (shot.secondChance) expect(shot.play).not.toBe("transition");
    }
  }
  expect(opportunities).toBeGreaterThan(0);
  expect(second).toBeGreaterThan(0);
});
it("rejects mismatched and unknown possession versions", () => {
  expect(() =>
    simulateMatch(team(0), { ...team(1), possessionVersion: undefined }, 1),
  ).toThrow();
  expect(() =>
    simulateMatch(
      { ...team(0), possessionVersion: 2 as 1 },
      { ...team(1), possessionVersion: 2 as 1 },
      1,
    ),
  ).toThrow();
});

it("rebounders can abandon a putback and create a kick-out three", async () => {
  const { createLeague } = await import("./league");
  const { createRun } = await import("./draft");
  const teams = createLeague({ ...createRun("free", true, 22), roster });
  const m = simulateMatch(teams[0], teams[1], 4);
  for (const shot of m.insights!.shots) {
    if (shot.putback) {
      expect(shot.zone).toBe("rim");
      expect(shot.kickout).toBe(false);
    }
    if (shot.kickout) expect(shot.putback).toBe(false);
  }
});
