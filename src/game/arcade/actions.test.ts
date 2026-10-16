import { describe, it, expect } from "vitest";
import { createGame } from "./setup";
import {
  advanceBall,
  attemptSteal,
  giveBall,
  jump,
  releaseShot,
} from "./actions";
import { stepGame, setPaused } from "./engine";
import { NO_INPUT } from "./types";
const roster = (n: number) => ({
  PG: n,
  SG: n + 1,
  SF: n + 2,
  PF: n + 3,
  C: n + 4,
  B1: n + 5,
  B2: n + 6,
  B3: n + 7,
});
const game = () => {
  const s = createGame({
    teams: [
      { name: "A", roster: roster(1) },
      { name: "B", roster: roster(20) },
    ],
    seed: 42,
  });
  s.phase = "live";
  return s;
};
describe("spatial actions", () => {
  it("records three-point attempts at release and scores the released value after movement", () => {
    const s = game(),
      p = s.players[0];
    p.x = 14;
    p.y = 7.5;
    giveBall(s, p);
    releaseShot(s, p, 0.65);
    s.ball.made = true;
    expect(p.stats.threePA).toBe(1);
    expect(p.stats.fga).toBe(1);
    p.x = 26;
    p.y = 7.5;
    advanceBall(s, 2);
    expect(s.score[0]).toBe(3);
    expect(p.stats.threePM).toBe(1);
    advanceBall(s, 0.1);
    expect(s.score[0]).toBe(3);
  });
  it("allows a positioned jumping defender to block a shot before it scores", () => {
    const s = game(),
      p = s.players[0],
      d = s.players[8];
    p.x = 23;
    p.y = 7.5;
    giveBall(s, p);
    releaseShot(s, p, 0.65);
    s.ball.made = true;
    d.x = 23.6;
    d.y = 7.5;
    d.z = 3;
    d.jumpTime = 0.5;
    d.action = "block";
    expect(advanceBall(s, 0.15)).toBe("miss");
    expect(s.ball.mode).toBe("loose");
    expect(d.stats.blocks).toBe(1);
    expect(s.score[0]).toBe(0);
  });
  it("steal cooldown prevents repeated checks and distant steals never transfer possession", () => {
    const s = game();
    s.players[0].x = 2;
    s.players[8].x = 20;
    giveBall(s, s.players[0]);
    attemptSteal(s, s.players[8]);
    const seed = s.seed;
    attemptSteal(s, s.players[8]);
    expect(s.ball.owner).toBe(0);
    expect(s.seed).toBe(seed);
    expect(s.players[8].cooldown).toBeGreaterThan(0);
  });
  it("expires hot streaks in live time and resets their counter", () => {
    const s = game();
    s.fire[0] = 0.01;
    s.streak[0] = 3;
    stepGame(s, NO_INPUT);
    expect(s.fire[0]).toBe(0);
    expect(s.streak[0]).toBe(0);
  });
  it("cancels charged shots when paused without spending an attempt", () => {
    const s = game();
    s.players[0].charge = 0.6;
    s.prevShoot = true;
    setPaused(s, true);
    setPaused(s, false);
    stepGame(s, NO_INPUT);
    expect(s.players[0].charge).toBeNull();
    expect(s.players[0].stats.fga).toBe(0);
  });
  it("a loose ball credits one rebound and acquires only one owner", () => {
    const s = game();
    s.ball.mode = "loose";
    s.ball.owner = null;
    s.ball.reboundOf = 0;
    s.ball.x = 4;
    s.ball.y = 4;
    s.ball.z = 0;
    s.players.forEach((p) => {
      p.x = 20;
      p.y = 10;
    });
    s.players[0].x = 4;
    s.players[0].y = 4;
    advanceBall(s, 0.02);
    advanceBall(s, 0.02);
    expect(s.ball.owner).toBe(0);
    expect(s.players[0].stats.offensiveRebounds).toBe(1);
    expect(s.events.filter((e) => e.kind === "rebound")).toHaveLength(1);
  });
});

describe("possession edge cases", () => {
  it("running beyond the sideline turns the ball over", () => {
    const s = game(),
      p = s.players[0];
    p.x = 14;
    p.y = 0.4;
    giveBall(s, p);
    s.controlled = p.id;
    stepGame(s, { ...NO_INPUT, moveY: -1 });
    expect(s.phase).toBe("inbound");
    expect(s.possession).toBe(1);
  });
  it("recovering your own blocked shot or fumbled pass preserves the possession clock", () => {
    const s = game();
    s.ball.mode = "loose";
    s.ball.owner = null;
    s.ball.reboundOf = 0;
    s.ball.x = 4;
    s.ball.y = 4;
    s.ball.z = 0;
    s.shotClock = 3;
    s.players.forEach((p) => {
      p.x = 20;
      p.y = 10;
    });
    s.players[0].x = 4;
    s.players[0].y = 4;
    advanceBall(s, 0.02);
    expect(s.ball.owner).toBe(0);
    expect(s.shotClock).toBe(3);
  });
  it("losing possession cancels shot charge and cannot auto-shoot after recovery", () => {
    const s = game();
    giveBall(s, s.players[0]);
    s.players[0].charge = 0.6;
    s.prevShoot = true;
    giveBall(s, s.players[8]);
    expect(s.players[0].charge).toBeNull();
    giveBall(s, s.players[0]);
    s.prevShoot = false;
    stepGame(s, NO_INPUT);
    expect(s.players[0].stats.fga).toBe(0);
  });
  it("a buzzer shot after the assist window cannot subtract flight time from its release", () => {
    const s = game(),
      p = s.players[0];
    p.x = 20;
    p.y = 7.5;
    giveBall(s, p);
    s.elapsed = 4;
    s.lastPass = { from: 1, to: 0, time: 0.5 };
    releaseShot(s, p, 0.65);
    s.ball.made = true;
    advanceBall(s, 2);
    expect(p.stats.points).toBeGreaterThan(0);
    expect(s.players[1].stats.assists).toBe(0);
  });
});
