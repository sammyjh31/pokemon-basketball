import { describe, expect, it } from "vitest";
import { emptyRoster, type Roster } from "./types";
import {
  draftComparisonMetrics,
  draftImpactLeaders,
  projectDraftImpact,
  projectDraftPool,
  rankDraftImpacts,
  type DraftImpact,
} from "./draftImpact";

const guards: Roster = { ...emptyRoster(), PG: 65, SG: 135 };
const row = (
  impact: NonNullable<ReturnType<typeof projectDraftImpact>>,
  key: string,
) => impact.metrics.find((metric) => metric.key === key)!;

describe("draft team impact", () => {
  it("ranks every eligible prospect by the selected team area without discarding negative changes", () => {
    const before = structuredClone(guards);
    const projections = projectDraftPool(
      [25, 112, 121, 65, 99999],
      guards,
      "B1",
      "balanced",
      "balanced",
    );
    expect(projections.map((p) => p.pokemonId)).toEqual([25, 112, 121]);
    const rebounds = rankDraftImpacts(projections, "rebounding");
    expect(rebounds.map((p) => p.pokemonId)).toEqual([112, 121, 25]);
    expect(rebounds[0]).toMatchObject({
      rank: 1,
      tied: false,
      metric: { after: 58, delta: 6 },
    });
    const shooting = rankDraftImpacts(projections, "spacing");
    expect(shooting.map((p) => p.pokemonId)).toEqual([121, 25, 112]);
    expect(shooting[0].metric.delta).toBe(-2);
    expect(projections.map((p) => p.pokemonId)).toEqual([25, 112, 121]);
    expect(guards).toEqual(before);
    expect(
      projectDraftPool([25], guards, "PG", "balanced", "balanced"),
    ).toEqual([]);
    const firstPick = rankDraftImpacts(
      projectDraftPool([25, 65], emptyRoster(), "PG", "balanced", "balanced"),
      "balance",
    );
    expect(firstPick.map((p) => p.pokemonId)).toEqual([65, 25]);
    expect(firstPick.every((p) => p.metric.delta === null)).toBe(true);
  });

  it("gives displayed ties the same rank with a stable species order", () => {
    const projections = projectDraftPool(
      [121, 112, 25],
      guards,
      "B1",
      "balanced",
      "balanced",
    );
    // Same displayed scores must tie regardless of their original pool order.
    projections.forEach((p) => {
      p.metrics.find((m) => m.key === "balance")!.after =
        p.pokemonId === 121 ? 59 : 60;
    });
    const ranked = rankDraftImpacts(projections, "balance");
    expect(ranked.map((p) => [p.pokemonId, p.rank, p.tied])).toEqual([
      [25, 1, true],
      [112, 1, true],
      [121, 3, false],
    ]);
    expect(rankDraftImpacts([], "balance")).toEqual([]);
  });

  it("compares balance without double-counting its component skills and preserves a missing baseline", () => {
    const impact: DraftImpact = {
      beforeCount: 2,
      afterCount: 3,
      metrics: [
        {
          key: "offense",
          label: "Overall offense",
          tool: false,
          before: 70,
          after: 80,
          delta: 10,
        },
        {
          key: "defense",
          label: "Overall defense",
          tool: false,
          before: 60,
          after: 60,
          delta: 0,
        },
        {
          key: "spacing",
          label: "Shooting / spacing",
          tool: true,
          before: 90,
          after: 30,
          delta: -60,
        },
      ],
    };
    expect(draftComparisonMetrics(impact)[0]).toMatchObject({
      key: "balance",
      before: 65,
      after: 70,
      delta: 5,
    });
    const firstPick = projectDraftImpact(
      emptyRoster(),
      25,
      "PG",
      "balanced",
      "balanced",
    )!;
    expect(
      draftComparisonMetrics(firstPick).every(
        (metric) => metric.before === null && metric.delta === null,
      ),
    ).toBe(true);
  });

  it("identifies tied leaders even when every option lowers the current average", () => {
    const projection = (pokemonId: number, after: number) => ({
      pokemonId,
      metrics: [
        {
          key: "offense" as const,
          label: "Overall offense",
          tool: false,
          before: 70,
          after,
          delta: after - 70,
        },
      ],
    });
    const projections = [
      projection(25, 50),
      projection(95, 60),
      projection(112, 60),
    ];
    expect(draftImpactLeaders(projections, "offense")).toEqual([95, 112]);
    expect(draftImpactLeaders(projections.slice(0, 2), "offense")).toEqual([
      95,
    ]);
    expect(draftImpactLeaders([], "offense")).toEqual([]);
  });

  it("shows an interior specialist's benefit and shooting tradeoff without changing the roster", () => {
    const before = structuredClone(guards);
    const impact = projectDraftImpact(guards, 95, "C", "balanced", "balanced")!;
    expect(impact.beforeCount).toBe(2);
    expect(impact.afterCount).toBe(3);
    expect(row(impact, "rimProtection").delta).toBeGreaterThan(0);
    expect(row(impact, "rebounding").delta).toBeGreaterThan(0);
    expect(row(impact, "spacing").delta).toBeLessThan(0);
    expect(guards).toEqual(before);
    for (const metric of impact.metrics) {
      expect(metric.after).toBeGreaterThanOrEqual(0);
      expect(metric.after).toBeLessThanOrEqual(100);
      expect(metric.delta).toBeCloseTo(metric.after - metric.before!, 1);
    }
  });

  it("treats the first pick as a foundation rather than a gain from a zero-rated team", () => {
    const impact = projectDraftImpact(
      emptyRoster(),
      65,
      "PG",
      "balanced",
      "balanced",
    )!;
    expect(impact.beforeCount).toBe(0);
    expect(impact.afterCount).toBe(1);
    expect(
      impact.metrics.every(
        (metric) => metric.before === null && metric.delta === null,
      ),
    ).toBe(true);
    expect(row(impact, "creation").after).toBeGreaterThan(
      row(impact, "rebounding").after,
    );
  });

  it("accounts for role fit, reserves, and coaching when estimating the new rotation", () => {
    const roleRoster = { ...emptyRoster(), SG: 135, SF: 6, PF: 68 };
    const center = projectDraftImpact(
      roleRoster,
      95,
      "C",
      "balanced",
      "balanced",
    )!;
    const guard = projectDraftImpact(
      roleRoster,
      95,
      "PG",
      "balanced",
      "balanced",
    )!;
    expect(row(center, "offense").after).toBeGreaterThan(
      row(guard, "offense").after,
    );
    const withBench = { ...guards, SF: 6, PF: 68, C: 143, B1: 121, B2: 131 };
    const starters = projectDraftImpact(
      withBench,
      95,
      "B3",
      "balanced",
      "starters",
    )!;
    const reserves = projectDraftImpact(
      withBench,
      95,
      "B3",
      "balanced",
      "bench",
    )!;
    expect(row(starters, "spacing").after).not.toBe(
      row(reserves, "spacing").after,
    );
    const defense = projectDraftImpact(
      roleRoster,
      95,
      "C",
      "defense",
      "balanced",
    )!;
    expect(row(defense, "defense").after).toBeGreaterThan(
      row(center, "defense").after,
    );
  });

  it("does not replace an owned player or count a duplicate as a new teammate", () => {
    expect(
      projectDraftImpact(guards, 95, "PG", "balanced", "balanced"),
    ).toBeNull();
    expect(
      projectDraftImpact(guards, 65, "C", "balanced", "balanced"),
    ).toBeNull();
    expect(
      projectDraftImpact(guards, 99999, "C", "balanced", "balanced"),
    ).toBeNull();
  });
});
