import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import { zoneShell } from "./courtPossession";
import type { Player } from "./matchLineups";

const teams = createLeague({
  ...createRun("free", true, 22),
  coach: { version: 1 as const, id: "misty" },
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});

describe("play depth on court rules v2", () => {
  it("runs only with game flow on court rules v2", () => {
    expect(teams[0].courtVersion).toBe(2);
    expect(teams[0].gameFlowVersion).toBe(1);
    const v1 = teams.map((t) => ({ ...t, courtVersion: 1 as const }));
    const m = simulateMatch(v1[0], v1[1], 9);
    expect(m.gameFlow!.heat).toBeUndefined();
    expect(
      m.insights!.court!.some((s) =>
        s.actions.some((a) => ["cut", "drift", "seal"].includes(a.kind)),
      ),
    ).toBe(false);
  });

  it("produces cuts, drifts, post seals and heat checks", () => {
    const kinds = new Set<string>();
    let heat = 0,
      hotAttempts = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const m = simulateMatch(teams[seed % 30], teams[(seed + 5) % 30], seed);
      for (const s of m.insights!.court!)
        for (const a of s.actions) kinds.add(a.kind);
      heat += m.gameFlow!.heat!.length;
      hotAttempts += m.gameFlow!.hotShots!.reduce((n, s) => n + s.attempts, 0);
      for (const side of ["home", "away"] as const)
        expect(m[`${side}Box`].reduce((n, b) => n + b.points, 0)).toBe(
          m[`${side}Score`],
        );
    }
    expect(kinds.has("cut")).toBe(true);
    expect(kinds.has("drift")).toBe(true);
    expect(kinds.has("seal")).toBe(true);
    expect(heat).toBeGreaterThan(0);
    expect(hotAttempts).toBeGreaterThan(0);
  });

  it("assigns zone spots by role", () => {
    const player = (id: number, a: Partial<Record<string, number>>): Player =>
      ({
        energy: 100,
        box: { playerId: `0:${id}` },
        profile: {
          attributes: {
            interiorDefense: 50,
            block: 50,
            speed: 50,
            perimeterDefense: 50,
            ...a,
          },
        },
      }) as unknown as Player;
    const anchor = player(1, { interiorDefense: 90, block: 90 }),
      quick = player(2, { speed: 90, perimeterDefense: 85 }),
      quicker = player(3, { speed: 95, perimeterDefense: 90 }),
      wingA = player(4, {}),
      wingB = player(5, {});
    const shell = zoneShell([wingA, anchor, quick, wingB, quicker]);
    expect(shell.get(anchor)).toBe(4);
    expect([shell.get(quick), shell.get(quicker)].sort()).toEqual([0, 1]);
    expect([shell.get(wingA), shell.get(wingB)].sort()).toEqual([2, 3]);
  });
});
