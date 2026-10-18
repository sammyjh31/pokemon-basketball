import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
const clubs = () =>
  createLeague({
    ...createRun("free", true, 882),
    roster: {
      PG: 65,
      SG: 135,
      SF: 149,
      PF: 68,
      C: 143,
      B1: 121,
      B2: 6,
      B3: 131,
    },
  }).map((t) => ({ ...t, courtVersion: 1 as const }));
it("runs real action sequences for CPU teams, preserving points, clocks, minutes and compact results", () => {
  const teams = clubs();
  const [h, a] = [teams[3], teams[15]];
  const before = JSON.stringify([h, a]);
  const match = simulateMatch(h, a, 711);
  expect(match.insights?.coordinateSystem).toBe("simulated-half-court");
  expect(match.insights?.court?.length).toBeGreaterThan(100);
  expect(match.insights!.court!.some((s) => s.actions.length >= 4)).toBe(true);
  expect(
    new Set(match.insights!.court!.map((s) => s.coverage).filter(Boolean)).size,
  ).toBeGreaterThan(1);
  expect(match).toEqual(simulateMatch(h, a, 711));
  expect({ ...match, insights: undefined }).toEqual(
    simulateMatch(h, a, 711, { collectInsights: false }),
  );
  expect(JSON.stringify([h, a])).toBe(before);
  for (const side of ["home", "away"] as const) {
    const boxes = match[`${side}Box`];
    expect(boxes.reduce((n, b) => n + b.points, 0)).toBe(match[`${side}Score`]);
    expect(boxes.reduce((n, b) => n + 2 * b.fgm + b.threePM + b.ftm, 0)).toBe(
      match[`${side}Score`],
    );
    expect(boxes.reduce((n, b) => n + b.minutes, 0)).toBeCloseTo(
      240 + 25 * match.overtimePeriods,
      8,
    );
    expect(
      boxes.every((b) => Number.isFinite(b.minutes) && b.minutes >= 0),
    ).toBe(true);
  }
  for (const s of match.insights!.court!) {
    expect(s.seconds).toBeGreaterThan(0);
    expect(s.seconds).toBeLessThanOrEqual(s.initialClock);
    expect(s.shotClock).toBeGreaterThanOrEqual(0);
    expect(s.positions).toHaveLength(10);
    expect(new Set(s.positions.map((p) => p.playerId)).size).toBe(10);
    expect(s.actions.length).toBeLessThanOrEqual(9);
    expect(
      s.actions.every(
        (action, i) => i === 0 || action.clock <= s.actions[i - 1].clock,
      ),
    ).toBe(true);
  }
  for (const shot of match.insights!.shots) {
    const seq = match.insights!.court![shot.courtSequence!];
    expect(seq.shooterId).toBe(shot.shooterId);
    expect(seq.defenderId).toBe(shot.defenderId);
    expect(seq.zone).toBe(shot.zone);
    expect(
      seq.positions.find((p) => p.playerId === shot.shooterId),
    ).toBeDefined();
  }
});
it("keeps old games free of new evidence and rejects mixed or unsupported court rules", () => {
  const [h, a] = clubs();
  expect(() =>
    simulateMatch(h, { ...a, courtVersion: undefined }, 1),
  ).toThrow();
  expect(() =>
    simulateMatch(
      { ...h, courtVersion: 4 as 3 },
      { ...a, courtVersion: 4 as 3 },
      1,
    ),
  ).toThrow();
  const legacy = simulateMatch(
    { ...h, courtVersion: undefined, gameFlowVersion: undefined },
    { ...a, courtVersion: undefined, gameFlowVersion: undefined },
    1,
  );
  expect(legacy.insights?.court).toBeUndefined();
  expect(legacy.insights?.coordinateSystem).toBe("schematic-half-court");
});
it("allows only defenders within recovery range to block a spatial shot", () => {
  const teams = clubs();
  let blocked = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const m = simulateMatch(teams[seed], teams[seed + 10], seed * 31);
    for (const shot of m.insights!.shots.filter((s) => s.blocked)) {
      const seq = m.insights!.court![shot.courtSequence!];
      const a = seq.positions.find((p) => p.playerId === shot.shooterId)!;
      const d = seq.positions.find((p) => p.playerId === shot.blockerId)!;
      expect(Math.hypot(a.x - d.x, a.y - d.y)).toBeLessThanOrEqual(10);
      blocked++;
    }
  }
  expect(blocked).toBeGreaterThan(5);
});
it("records fouls and turnovers instead of phantom shot actions when an attack ends before a shot", () => {
  const teams = clubs(),
    m = simulateMatch(teams[5], teams[16], 412);
  const shotSequences = new Set(m.insights!.shots.map((s) => s.courtSequence));
  m.insights!.court!.forEach((seq, index) => {
    expect(seq.actions.some((a) => a.kind === "shoot")).toBe(
      shotSequences.has(index),
    );
  });
});
it("derives putbacks and screen credit from actual court actions without duplicate spatial bonuses", () => {
  const teams = clubs(),
    m = simulateMatch(teams[3], teams[15], 711);
  let putbacks = 0;
  for (const shot of m.insights!.shots) {
    const seq = m.insights!.court![shot.courtSequence!];
    const direct =
      shot.secondChance &&
      !seq.actions.some((a) =>
        ["screen", "drive", "pass", "kickout", "reset"].includes(a.kind),
      );
    if (direct) {
      expect(shot.putback).toBe(true);
      putbacks++;
    }
    expect(shot.matchup!.screen).toBe(0);
  }
  expect(putbacks).toBeGreaterThan(0);
  const credited = m.insights!.possession!.players.reduce(
    (n, p) => n + p.screenAssists,
    0,
  );
  const screenedMakes = m.insights!.shots.filter(
    (s) =>
      s.made &&
      m.insights!.court![s.courtSequence!].actions.some(
        (a) => a.kind === "screen",
      ),
  ).length;
  expect(credited).toBeLessThanOrEqual(screenedMakes);
});
