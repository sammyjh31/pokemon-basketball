import { describe, expect, it } from "vitest";
import { createLineupDraftProjector } from "./draftLineup";
import {
  projectDraftImpact,
  projectDraftPool,
  rankDraftImpacts,
} from "./draftImpact";
import { emptyRoster, ROSTER_SLOTS } from "./types";

describe("lineup-aware draft impact", () => {
  it("holds locked starters and reserves in both baselines and candidate lineups", () => {
    const roster = { ...emptyRoster(), PG: 95, C: 65, B1: 143 };
    const before = JSON.stringify(roster);
    for (const focus of ["balance", "spacing", "rebounding"] as const) {
      const project = createLineupDraftProjector(
        roster,
        "balanced",
        "balanced",
        focus,
        ["PG", "B1"],
      );
      for (const id of [25, 112, 135]) {
        const result = project(id)!;
        expect(result.lineup!.before.PG).toBe(95);
        expect(result.lineup!.after.PG).toBe(95);
        expect(result.lineup!.before.B1).toBe(143);
        expect(result.lineup!.after.B1).toBe(143);
        expect(result.slot).not.toBe("PG");
        expect(result.slot).not.toBe("B1");
        expect(
          Object.values(result.lineup!.after).filter(Boolean).sort(),
        ).toEqual([95, 65, 143, id].sort());
      }
    }
    expect(JSON.stringify(roster)).toBe(before);
  });

  it("reduces to best-open ranking when every owned player is locked and frees positions on unlock", () => {
    const roster = { ...emptyRoster(), PG: 95, SG: 25, B2: 143 };
    const project = createLineupDraftProjector(
      roster,
      "perimeter",
      "bench",
      "balance",
      ["PG", "SG", "B2"],
    );
    for (const id of [65, 112, 135]) {
      const locked = project(id)!;
      const fixed = rankDraftImpacts(
        projectDraftPool([id], roster, "best-open", "perimeter", "bench"),
        "balance",
      )[0];
      expect(locked.metrics.find((m) => m.key === "balance")!.after).toBe(
        fixed.metric.after,
      );
      expect(locked.lineup!.before).toEqual(roster);
    }
    const single = { ...emptyRoster(), PG: 95 };
    const locked = createLineupDraftProjector(
      single,
      "balanced",
      "balanced",
      "balance",
      ["PG"],
    )(65)!;
    const free = createLineupDraftProjector(
      single,
      "balanced",
      "balanced",
      "balance",
    )(65)!;
    expect(locked.slot).not.toBe("PG");
    expect(free.slot).toBe("PG");
  });

  it("frees an occupied role and measures gains against a rearranged baseline", () => {
    const roster = { ...emptyRoster(), PG: 95 };
    const saved = JSON.stringify(roster);
    const project = createLineupDraftProjector(
      roster,
      "balanced",
      "balanced",
      "balance",
    );
    const result = project(65)!;
    expect(result.slot).toBe("PG");
    expect(result.lineup!.before.C).toBe(95);
    expect(result.lineup!.after.PG).toBe(65);
    expect(Object.values(result.lineup!.after)).toContain(95);
    const fair = projectDraftImpact(
      { ...emptyRoster(), C: 95 },
      65,
      "PG",
      "balanced",
      "balanced",
    )!;
    expect(result.impact.metrics.map((m) => m.before)).toEqual(
      fair.metrics.map((m) => m.before),
    );
    expect(
      result.metrics.find((m) => m.key === "balance")!.after,
    ).toBeGreaterThanOrEqual(
      (fair.metrics[0].after + fair.metrics[1].after) / 2 - 0.05,
    );
    expect(JSON.stringify(roster)).toBe(saved);
    expect(project(95)).toBeNull();
    expect(project(-1)).toBeNull();
  });

  it("keeps every teammate, can promote reserves, and never underperforms leaving positions alone", () => {
    const roster = {
      ...emptyRoster(),
      PG: 95,
      SG: 143,
      SF: 9,
      PF: 25,
      C: 6,
      B1: 65,
      B2: 135,
    };
    for (const focus of ["balance", "spacing", "rebounding"] as const) {
      const result = createLineupDraftProjector(
        roster,
        "perimeter",
        "bench",
        focus,
      )(112)!;
      expect(Object.values(result.lineup!.after).sort()).toEqual(
        [95, 143, 9, 25, 6, 65, 135, 112].sort(),
      );
      const fixed = rankDraftImpacts(
        projectDraftPool([112], roster, "best-open", "perimeter", "bench"),
        focus,
      )[0];
      expect(
        result.metrics.find((m) => m.key === focus)!.after,
      ).toBeGreaterThanOrEqual(fixed.metric.after);
      expect(result).toEqual(
        createLineupDraftProjector(roster, "perimeter", "bench", focus)(112),
      );
    }
    expect(
      createLineupDraftProjector(
        Object.fromEntries(
          ROSTER_SLOTS.map((s, i) => [s, i + 1]),
        ) as typeof roster,
        "balanced",
        "balanced",
        "balance",
      )(112),
    ).toBeNull();
  });

  it("uses a shared baseline for every prospect and retains the empty-roster first-pick convention", () => {
    const project = createLineupDraftProjector(
      { ...emptyRoster(), PG: 95, C: 65 },
      "pace",
      "starters",
      "creation",
    );
    const a = project(25)!,
      b = project(112)!;
    expect(a.lineup!.before).toEqual(b.lineup!.before);
    expect(a.impact.metrics.map((m) => m.before)).toEqual(
      b.impact.metrics.map((m) => m.before),
    );
    expect(
      createLineupDraftProjector(
        emptyRoster(),
        "balanced",
        "balanced",
        "balance",
      )(65)!.metrics.every((m) => m.before === null && m.delta === null),
    ).toBe(true);
  });
});
