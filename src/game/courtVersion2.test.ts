import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import type { LeagueTeam } from "./types";

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
const clubs = (
  seed: number,
  courtVersion: 1 | 2,
  current = false,
): LeagueTeam[] => {
  const run = { ...createRun("free", true, seed), roster };
  if (!current) {
    // Reproduce seasons saved before species abilities and shared evaluation.
    delete run.abilityVersion;
    delete run.evaluationVersion;
  }
  return createLeague(run).map((t) => ({ ...t, courtVersion }));
};

it("leaves version-1 court results byte-identical for saved replays", () => {
  const teams = clubs(31337, 1),
    hash = createHash("sha256");
  for (let i = 0; i < 60; i++)
    hash.update(
      JSON.stringify(
        simulateMatch(teams[i % 30], teams[(i + 11) % 30], 99 + i),
      ),
    );
  expect(hash.digest("hex")).toBe(
    "4bfdc1573196249cb2830512e20f8d499aaa76c49d109bbcd014a1feb4c56506",
  );
});

it("keeps version-2 box scores consistent with recorded court sequences", () => {
  const teams = clubs(882, 2);
  for (let seed = 1; seed <= 12; seed++) {
    const m = simulateMatch(teams[seed], teams[29 - seed], seed);
    for (const side of ["home", "away"] as const) {
      const box = side === "home" ? m.homeBox : m.awayBox,
        teamId = box[0].teamId;
      expect(box.reduce((n, p) => n + p.points, 0)).toBe(
        side === "home" ? m.homeScore : m.awayScore,
      );
      expect(box.reduce((n, p) => n + p.minutes, 0)).toBeCloseTo(
        240 + 25 * m.overtimePeriods,
        6,
      );
      const ended = m.insights!.court!.filter(
        (s) =>
          s.offenseTeamId === teamId &&
          (s.outcome === "turnover" || s.outcome === "violation"),
      ).length;
      expect(box.reduce((n, p) => n + p.turnovers, 0)).toBe(ended);
      const opponent = side === "home" ? m.awayBox : m.homeBox;
      expect(box.reduce((n, p) => n + p.steals, 0)).toBeLessThanOrEqual(
        opponent.reduce((n, p) => n + p.turnovers, 0),
      );
      expect(box.reduce((n, p) => n + p.assists, 0)).toBeLessThanOrEqual(
        box.reduce((n, p) => n + p.fgm, 0),
      );
    }
    for (const s of m.insights!.court!)
      if (s.outcome === "made" || s.outcome === "missed")
        expect(s.actions.at(-1)?.kind).toBe("shoot");
  }
});

it("brings version-2 turnovers, threes, assists and foul-outs into basketball ranges", () => {
  const rates = (version: 1 | 2) => {
    const teams = clubs(9824, version),
      t = { fga: 0, fgm: 0, tpa: 0, fta: 0, tov: 0, ast: 0, outs: 0 };
    const games = 80;
    for (let i = 0; i < games; i++) {
      const m = simulateMatch(
        teams[i % 30],
        teams[((i % 30) + 1 + (i % 29)) % 30],
        512000 + i,
      );
      for (const p of [...m.homeBox, ...m.awayBox]) {
        t.fga += p.fga;
        t.fgm += p.fgm;
        t.tpa += p.threePA;
        t.fta += p.fta;
        t.tov += p.turnovers;
        t.ast += p.assists;
        t.outs += Number(p.fouls >= 6);
      }
    }
    return {
      tovPct: t.tov / (t.fga + 0.44 * t.fta + t.tov),
      threeRate: t.tpa / t.fga,
      assisted: t.ast / t.fgm,
      foulOuts: t.outs / games,
      fgPct: t.fgm / t.fga,
    };
  };
  const v1 = rates(1),
    v2 = rates(2);
  expect(v2.tovPct).toBeGreaterThan(0.1);
  expect(v2.tovPct).toBeLessThan(0.15);
  expect(v2.threeRate).toBeGreaterThan(0.33);
  expect(v2.threeRate).toBeLessThan(0.45);
  expect(v2.assisted).toBeGreaterThan(0.5);
  expect(v2.assisted).toBeLessThan(0.68);
  expect(v2.foulOuts).toBeLessThan(0.35);
  expect(v2.fgPct).toBeGreaterThan(0.43);
  expect(v2.fgPct).toBeLessThan(0.5);
  expect(v2.tovPct).toBeGreaterThan(v1.tovPct);
  expect(v2.threeRate).toBeGreaterThan(v1.threeRate);
  expect(v2.assisted).toBeGreaterThan(v1.assisted);
  expect(v2.foulOuts).toBeLessThan(v1.foulOuts);
});

it("lets press defense and perimeter tactics matter under version 2", () => {
  const teams = clubs(4401, 2);
  const sample = (patch: (h: LeagueTeam, a: LeagueTeam) => void) => {
    let tov = 0,
      tpa = 0,
      fga = 0;
    for (let i = 0; i < 60; i++) {
      const h = { ...teams[i % 30] },
        a = { ...teams[(i + 13) % 30] };
      patch(h, a);
      const m = simulateMatch(h, a, 9000 + i);
      for (const p of m.homeBox) {
        tov += p.turnovers;
        tpa += p.threePA;
        fga += p.fga;
      }
    }
    return { tov, threeRate: tpa / fga };
  };
  const base = sample((h, a) => {
    h.tactic = "balanced";
    a.defense = "man";
  });
  const pressed = sample((h, a) => {
    h.tactic = "balanced";
    a.defense = "press";
  });
  const perimeter = sample((h, a) => {
    h.tactic = "perimeter";
    a.defense = "man";
  });
  expect(pressed.tov).toBeGreaterThan(base.tov * 1.1);
  expect(perimeter.threeRate).toBeGreaterThan(base.threeRate + 0.05);
});
