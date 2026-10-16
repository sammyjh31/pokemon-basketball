import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { aiMotion } from "./ai";
import {
  stepGame,
  setPaused,
  continuePeriod,
  queueSubstitution,
} from "./engine";
import type { ArcadeInput, ArcadeSetup } from "./types";
const roster = (start: number) => ({
  PG: start,
  SG: start + 1,
  SF: start + 2,
  PF: start + 3,
  C: start + 4,
  B1: start + 5,
  B2: start + 6,
  B3: start + 7,
});
const setup = (): ArcadeSetup => ({
  teams: [
    { name: "Home", roster: roster(1) },
    { name: "Away", roster: roster(20) },
  ],
  seed: 42,
});
const idle: ArcadeInput = {
  moveX: 0,
  moveY: 0,
  shoot: false,
  pass: false,
  switch: false,
  turbo: false,
};
describe("arcade world", () => {
  it("creates five active players and three reserves on each team without mutating the roster", () => {
    const source = setup(),
      before = JSON.stringify(source),
      s = createGame(source);
    expect(s.players).toHaveLength(16);
    for (const team of [0, 1])
      expect(s.players.filter((p) => p.team === team && p.active)).toHaveLength(
        5,
      );
    expect(s.clock).toBe(60);
    expect(s.score).toEqual([0, 0]);
    expect(JSON.stringify(source)).toBe(before);
  });
  it("rejects missing, duplicate and unknown species before the game starts", () => {
    const x = setup();
    x.teams[0].roster.C = null;
    expect(() => createGame(x)).toThrow();
    const y = setup();
    y.teams[1].roster.C = 1;
    expect(() => createGame(y)).toThrow();
    const z = setup();
    z.teams[0].roster.C = 9999;
    expect(() => createGame(z)).toThrow();
  });
  it("pauses clock, movement and held shot without an involuntary shot on resume", () => {
    const s = createGame(setup());
    s.phase = "live";
    s.ball.owner = 0;
    s.ball.mode = "held";
    s.controlled = 0;
    stepGame(s, { ...idle, shoot: true, moveX: 1 });
    setPaused(s, true);
    const snap = JSON.stringify(s);
    for (let n = 0; n < 60; n++) stepGame(s, idle);
    expect(JSON.stringify(s)).toBe(snap);
    setPaused(s, false);
    stepGame(s, idle);
    expect(s.players[0].stats.fga).toBe(0);
  });
  it("allows queued substitutions only between unique same-team active and reserve players", () => {
    const s = createGame(setup());
    s.phase = "live";
    expect(queueSubstitution(s, 0, 5)).toBe(true);
    expect(queueSubstitution(s, 1, 5)).toBe(false);
    expect(queueSubstitution(s, 0, 8)).toBe(false);
    s.phase = "break";
    continuePeriod(s);
    expect(s.players[0].active).toBe(false);
    expect(s.players[5].active).toBe(true);
    expect(s.players.filter((p) => p.team === 0 && p.active)).toHaveLength(5);
  });
  it("advances tied regulation to overtime and ends a decided overtime", () => {
    const s = createGame(setup());
    s.phase = "live";
    s.period = 4;
    s.clock = 0.001;
    s.score = [2, 2];
    stepGame(s, idle);
    expect(s.phase).toBe("break");
    continuePeriod(s);
    expect(s.period).toBe(5);
    expect(s.clock).toBe(30);
    s.phase = "live";
    s.clock = 0.001;
    s.score = [4, 2];
    s.ball.mode = "held";
    stepGame(s, idle);
    expect(s.phase).toBe("final");
  });
  it("reproduces spatial play from the same seed and input", () => {
    const a = createGame(setup()),
      b = createGame(setup());
    for (let i = 0; i < 500; i++) {
      const input = {
        ...idle,
        moveX: i % 60 < 30 ? 1 : -1,
        shoot: i % 70 < 38,
        pass: i % 90 === 0,
      };
      stepGame(a, input);
      stepGame(b, input);
    }
    expect(a).toEqual(b);
  });
});

describe("arcade live basketball", () => {
  it("moves the controlled ball handler and follows a directional pass through flight", () => {
    const s = createGame(setup());
    s.phase = "live";
    s.ball.mode = "held";
    s.ball.owner = 0;
    s.controlled = 0;
    s.players[0].x = 4;
    s.players[0].y = 7;
    s.players[1].x = 8;
    s.players[1].y = 7;
    const old = s.players[0].x;
    for (let i = 0; i < 10; i++) stepGame(s, { ...idle, moveX: 1 });
    expect(s.players[0].x).toBeGreaterThan(old);
    s.passTarget = 1;
    stepGame(s, { ...idle, pass: true });
    expect(s.ball.mode).toBe("pass");
    expect(s.ball.owner).toBeNull();
    for (let i = 0; i < 90 && String(s.ball.mode) === "pass"; i++)
      stepGame(s, idle);
    expect(s.ball.owner).toBe(1);
    expect(s.controlled).toBe(1);
  });
  it("resolves a legal buzzer shot exactly once and does not award a dead-ball rebound", () => {
    const s = createGame(setup());
    s.phase = "live";
    s.clock = 0.01;
    s.period = 4;
    s.score = [0, 0];
    s.ball = {
      ...s.ball,
      mode: "shot",
      owner: null,
      from: 0,
      made: true,
      shotValue: 3,
      travel: 0,
      duration: 0.1,
      start: { x: 20, y: 7.5, z: 1 },
      end: { x: 26.5, y: 7.5, z: 3 },
      x: 20,
      y: 7.5,
      z: 1,
    };
    for (let i = 0; i < 30; i++) stepGame(s, idle);
    expect(s.score).toEqual([3, 0]);
    expect(s.phase).toBe("final");
    expect(s.events.filter((e) => e.kind === "score")).toHaveLength(1);
    expect(s.events.filter((e) => e.kind === "rebound")).toHaveLength(0);
  });
  it("ends a held-ball possession at the shot clock without negative clocks", () => {
    const s = createGame(setup());
    s.phase = "live";
    s.shotClock = 0.001;
    s.ball.owner = 0;
    s.ball.mode = "held";
    stepGame(s, idle);
    expect(s.phase).toBe("inbound");
    expect(s.possession).toBe(1);
    expect(s.shotClock).toBe(14);
    expect(s.clock).toBeGreaterThan(0);
  });
  it("accounts for exactly five players worth of live game-clock time per team", () => {
    const s = createGame(setup());
    s.phase = "live";
    for (let i = 0; i < 30; i++) stepGame(s, idle);
    for (const team of [0, 1])
      expect(
        s.players
          .filter((p) => p.team === team)
          .reduce((n, p) => n + p.stats.seconds, 0),
      ).toBeCloseTo(s.elapsed * 5, 6);
  });
});

describe("complete arcade match", () => {
  it("finishes seeded CPU play with conserved scoring and ten active players", () => {
    const s = createGame(setup());
    for (let i = 0; i < 60000 && s.phase !== "final"; i++) {
      if (s.phase === "break") continuePeriod(s);
      // Drive both teams with the same public engine's CPU decisions.
      s.controlled = -1;
      stepGame(s, idle);
    }
    expect(s.phase).toBe("final");
    expect(s.score[0] + s.score[1]).toBeGreaterThan(10);
    expect(s.score[0]).not.toBe(s.score[1]);
    for (const team of [0, 1]) {
      const players = s.players.filter((p) => p.team === team);
      expect(players.filter((p) => p.active)).toHaveLength(5);
      expect(players.reduce((n, p) => n + p.stats.points, 0)).toBe(
        s.score[team],
      );
      expect(players.reduce((n, p) => n + p.stats.seconds, 0)).toBeCloseTo(
        s.elapsed * 5,
        5,
      );
      expect(
        s.events
          .filter((e) => e.kind === "score" && e.team === team)
          .reduce((n, e) => n + (e.value ?? 0), 0),
      ).toBe(s.score[team]);
    }
  });
});

it("keeps positions, inbound ownership, and AI roles stable after replacing the point guard", () => {
  const original = createGame(setup()),
    subbed = createGame(setup());
  for (const s of [original, subbed]) {
    s.phase = "break";
    s.period = 2;
  }
  queueSubstitution(subbed, 0, 5);
  continuePeriod(original);
  continuePeriod(subbed);
  expect(subbed.ball.owner).toBe(5);
  expect(subbed.players[5].slot).toBe("PG");
  for (let id = 1; id <= 4; id++) {
    expect([subbed.players[id].x, subbed.players[id].y]).toEqual([
      original.players[id].x,
      original.players[id].y,
    ]);
  }
  for (const owner of [1, 8]) {
    for (const s of [original, subbed]) {
      s.ball.owner = owner;
      s.ball.mode = "held";
    }
    expect(aiMotion(subbed, subbed.players[5])).toEqual(
      aiMotion(original, original.players[0]),
    );
  }
});
