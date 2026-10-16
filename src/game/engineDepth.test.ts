import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { simulateMatch } from "./match";
import { teamRatings } from "./ratings";
import { ROSTER_SLOTS, type LeagueTeam, type Roster } from "./types";
import type { EngineRules } from "./engineInsightsTypes";

const IDS = [65, 135, 149, 68, 143, 121, 6, 131];
const rules: EngineRules = {
  version: 1,
  abilities: true,
  adaptiveCoaching: true,
  familiarity: 0.4,
};
const team = (id: number, changes: Partial<LeagueTeam> = {}): LeagueTeam => {
  const roster = Object.fromEntries(
    ROSTER_SLOTS.map((s, i) => [s, IDS[i]]),
  ) as Roster;
  return {
    id,
    name: String(id),
    roster,
    tactic: "balanced",
    rotation: "balanced",
    defense: "man",
    ratings: teamRatings(roster),
    ...changes,
  };
};
const deepTeam = (id: number, changes: Partial<LeagueTeam> = {}) =>
  team(id, { simulationVersion: 2, engineRules: rules, ...changes });

describe("versioned engine depth", () => {
  it("preserves byte-for-byte historical legacy and model-2 replays when rules are absent", () => {
    for (const [modern, hash] of [
      [
        false,
        "ca9afdc44cd0695c5598510e80adaed2a1359e52c90397b275eddb5350837d34",
      ],
      [
        true,
        "5fad27bdcde19842c59d617b4aadbfda46e99fd075891bb897977aed7d0c4061",
      ],
    ] as const) {
      const changes = modern ? { simulationVersion: 2 as const } : {};
      const games = [1, 42, 400, 8901].map((seed) =>
        simulateMatch(team(0, changes), team(1, changes), seed),
      );
      expect(
        createHash("sha256").update(JSON.stringify(games)).digest("hex"),
      ).toBe(hash);
      expect(games.every((game) => game.insights === undefined)).toBe(true);
    }
  });

  it("records actual shot attempts, defenders and outcomes that reconcile to every player box", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const game = simulateMatch(deepTeam(0), deepTeam(1), seed);
      expect(game.insights).toBeDefined();
      const insights = game.insights!;
      expect(insights.coordinateSystem).toBe("schematic-half-court");
      const boxes = [...game.homeBox, ...game.awayBox];
      for (const player of boxes) {
        const shots = insights.shots.filter(
          (s) => s.shooterId === player.playerId,
        );
        expect(shots.filter((s) => s.countsAsAttempt).length).toBe(player.fga);
        expect(shots.filter((s) => s.made).length).toBe(player.fgm);
        expect(shots.reduce((n, s) => n + (s.made ? s.value : 0), 0)).toBe(
          player.points - player.ftm,
        );
        const defense = insights.defense.find(
          (d) => d.playerId === player.playerId,
        )!;
        expect(defense.blocks).toBe(player.blocks);
        expect(defense.steals).toBe(player.steals);
        expect(defense.deflections).toBeGreaterThanOrEqual(defense.steals);
        expect(defense.attempts).toBe(
          insights.shots.filter(
            (s) => s.defenderId === player.playerId && s.countsAsAttempt,
          ).length,
        );
        expect(defense.pointsAllowed).toBe(
          insights.shots
            .filter((s) => s.defenderId === player.playerId && s.made)
            .reduce((n, s) => n + s.value, 0),
        );
      }
      for (const shot of insights.shots) {
        expect(shot.expectedProbability).toBeGreaterThan(0);
        expect(shot.expectedProbability).toBeLessThan(1);
        expect(shot.elapsedSeconds).toBeGreaterThanOrEqual(0);
        expect(shot.period).toBeGreaterThanOrEqual(1);
        expect(
          boxes.some(
            (b) =>
              b.playerId === shot.defenderId && b.teamId === shot.defenseTeamId,
          ),
        ).toBe(true);
        expect(shot.x).toBeGreaterThanOrEqual(0);
        expect(shot.x).toBeLessThanOrEqual(100);
        expect(shot.y).toBeGreaterThanOrEqual(0);
        expect(shot.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it("conserves five-player lineup time and points through substitutions, free throws and overtime", () => {
    for (let seed = 40; seed < 80; seed++) {
      const game = simulateMatch(deepTeam(0), deepTeam(1), seed);
      expect(game.insights).toBeDefined();
      for (const [id, box, forPoints, against] of [
        [0, game.homeBox, game.homeScore, game.awayScore],
        [1, game.awayBox, game.awayScore, game.homeScore],
      ] as const) {
        const lineups = game.insights!.lineups.filter((l) => l.teamId === id);
        expect(lineups.reduce((n, l) => n + l.seconds, 0)).toBe(
          2880 + 300 * game.overtimePeriods,
        );
        expect(lineups.reduce((n, l) => n + l.pointsFor, 0)).toBe(forPoints);
        expect(lineups.reduce((n, l) => n + l.pointsAgainst, 0)).toBe(against);
        expect(lineups.every((l) => new Set(l.playerIds).size === 5)).toBe(
          true,
        );
        for (const player of box)
          expect(
            lineups
              .filter((l) => l.playerIds.includes(player.playerId))
              .reduce((n, l) => n + l.seconds, 0),
          ).toBe(player.minutes * 60);
      }
    }
  });

  it("logs evidence-based coaching changes only for teams with adaptation enabled", () => {
    const active = simulateMatch(
      deepTeam(0),
      deepTeam(1, {
        tactic: "perimeter",
        engineRules: { ...rules, adaptiveCoaching: false },
      }),
      42,
    );
    expect(active.insights).toBeDefined();
    expect(active.insights!.adjustments.length).toBeGreaterThan(0);
    for (const adjustment of active.insights!.adjustments) {
      expect(adjustment.teamId).toBe(0);
      expect(adjustment.period).toBeGreaterThan(1);
      expect(adjustment.reason.length).toBeGreaterThan(5);
      expect(adjustment.evidence).toMatch(/\d/);
      expect(adjustment.to).not.toBe(adjustment.from);
    }
  });

  it("replays depth events deterministically without mutating either club", () => {
    const home = deepTeam(0),
      away = deepTeam(1);
    const before = JSON.stringify([home, away]);
    expect(simulateMatch(home, away, 42).insights).toBeDefined();
    expect(simulateMatch(home, away, 42)).toEqual(
      simulateMatch(home, away, 42),
    );
    expect(JSON.stringify([home, away])).toBe(before);
  });
});

describe("situational depth effects", () => {
  it("applies togglable signatures to shots while preserving deterministic replay", () => {
    const on = simulateMatch(
      deepTeam(0, { engineRules: { ...rules, adaptiveCoaching: false } }),
      deepTeam(1),
      294,
    );
    const off = simulateMatch(
      deepTeam(0, {
        engineRules: { ...rules, abilities: false, adaptiveCoaching: false },
      }),
      deepTeam(1),
      294,
    );
    expect(on.insights!.shots.map((s) => s.expectedProbability)).not.toEqual(
      off.insights!.shots.map((s) => s.expectedProbability),
    );
  });

  it("makes continuity change teamwork independently of signature abilities", () => {
    const fresh = simulateMatch(
      deepTeam(0, {
        engineRules: {
          ...rules,
          familiarity: 0,
          abilities: false,
          adaptiveCoaching: false,
        },
      }),
      deepTeam(1),
      348,
    );
    const settled = simulateMatch(
      deepTeam(0, {
        engineRules: {
          ...rules,
          familiarity: 1,
          abilities: false,
          adaptiveCoaching: false,
        },
      }),
      deepTeam(1),
      348,
    );
    expect(fresh.insights!.shots.map((s) => s.expectedProbability)).not.toEqual(
      settled.insights!.shots.map((s) => s.expectedProbability),
    );
  });

  it("records live pass disruptions and contest events rather than relabeling every attempt", () => {
    const game = simulateMatch(deepTeam(0), deepTeam(1), 42);
    expect(
      game.insights!.defense.reduce((n, d) => n + d.deflections - d.steals, 0),
    ).toBeGreaterThan(0);
    expect(game.insights!.shots.some((s) => s.contested)).toBe(true);
    expect(game.insights!.shots.some((s) => !s.contested)).toBe(true);
  });
});

describe("invalid depth rules", () => {
  it("rejects unsupported versions and non-finite or out-of-range continuity", () => {
    for (const invalid of [
      { ...rules, version: 7 },
      { ...rules, familiarity: NaN },
      { ...rules, familiarity: 2 },
      { ...rules, abilities: "yes" },
      { ...rules, adaptiveCoaching: null },
    ])
      expect(() =>
        simulateMatch(
          deepTeam(0, { engineRules: invalid as EngineRules }),
          deepTeam(1),
          1,
        ),
      ).toThrow(/engine|rules|familiarity/i);
  });
});

it("bases a move inside on its own observed perimeter struggles", () => {
  let decisions = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const game = simulateMatch(
      deepTeam(0),
      deepTeam(1, { tactic: "perimeter" }),
      seed,
    );
    for (const change of game.insights!.adjustments.filter(
      (a) => a.kind === "tactic" && a.to === "interior",
    )) {
      decisions++;
      const prior = game.insights!.shots.filter(
        (s) =>
          s.period === change.period - 1 &&
          s.offenseTeamId === change.teamId &&
          s.zone === "three",
      );
      expect(prior.length).toBeGreaterThanOrEqual(6);
      expect(prior.filter((s) => s.made).length / prior.length).toBeLessThan(
        0.28,
      );
    }
  }
  expect(decisions).toBeGreaterThan(0);
});

it("collects telemetry without changing gameplay RNG or the final score", () => {
  const recorded = simulateMatch(deepTeam(0), deepTeam(1), 993);
  const compact = simulateMatch(deepTeam(0), deepTeam(1), 993, {
    collectInsights: false,
  });
  expect(recorded.insights).toBeDefined();
  expect(compact.insights).toBeUndefined();
  const { insights: _ignored, ...withoutInsights } = recorded;
  expect(compact).toEqual(withoutInsights);
});

it("uses the opponent coverage observed before both coaches make their break adjustments", () => {
  const game = simulateMatch(deepTeam(0), deepTeam(1), 993);
  for (const change of game.insights!.adjustments.filter(
    (a) => a.kind === "tactic",
  )) {
    const opponent = change.teamId === 0 ? 1 : 0;
    const previous =
      game
        .insights!.adjustments.filter(
          (a) =>
            a.teamId === opponent &&
            a.kind === "defense" &&
            a.period < change.period,
        )
        .at(-1)?.to ?? "man";
    expect(change.evidence).toContain(`opponent coverage ${previous}.`);
  }
});
