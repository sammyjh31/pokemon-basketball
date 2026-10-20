import { expect, it, vi } from "vitest";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { simulateMatch } from "./match";
import { signatureMoves } from "./signatureMoves";
import { comboPlays, COMBO_IDS } from "./comboTypes";
import { SIGNATURE_MOVE_IDS } from "./moveTypes";
import { signatureTeam } from "./signatureTestUtils";
import { pairKey } from "./teammateChemistry";
import { coachRotationMinutes } from "./coachPolicy";
function clubs() {
  return createLeague(performanceRun()).map((team) => {
    const ids = Object.values(team.roster) as number[];
    return {
      ...team,
      movesetVersion: 2 as const,
      abilityMastery: Object.fromEntries(ids.map((id) => [id, 400])),
      chemistryBonds: Object.fromEntries(
        ids.flatMap((a, i) =>
          ids.slice(i + 1).map((b) => [pairKey(a, b), 1200]),
        ),
      ),
    };
  });
}
it("resolves signatures and coach-timed combinations from real actions with exact participant counters", () => {
  const teams = clubs();
  let signatures = 0,
    setups = 0,
    shots = 0;
  for (const seed of [7, 42, 81]) {
    const match = simulateMatch(teams[0], teams[1], seed);
    const sequences = match.insights!.court!;
    expect(match.comboAssignments?.[teams[0].id].length).toBeGreaterThan(0);
    for (const sequence of sequences) {
      const events = sequence.combos ?? [];
      signatures += (sequence.moves ?? []).filter((e) =>
        signatureMoves.some((m) => m.id === e.move),
      ).length;
      expect(
        events.filter((e) => e.stage === "setup").length,
      ).toBeLessThanOrEqual(1);
      for (const event of events) {
        expect(event.playerIds[0]).not.toBe(event.playerIds[1]);
        expect(
          event.playerIds.every((id) =>
            sequence.positions.some((p) => p.playerId === id && p.offense),
          ),
        ).toBe(true);
        const definition = comboPlays.find((p) => p.id === event.id)!;
        const setup = sequence.actions.findIndex(
          (a) =>
            a.kind === definition.setup &&
            a.playerId === event.playerIds[0] &&
            a.targetId === event.playerIds[1],
        );
        expect(setup).toBeGreaterThanOrEqual(0);
        if (event.id === "drive-kick")
          expect(
            sequence.actions
              .slice(0, setup)
              .some(
                (a) => a.kind === "drive" && a.playerId === event.playerIds[0],
              ),
          ).toBe(true);
        if (event.stage === "setup") {
          setups++;
          expect(event.energySpent.every((n) => n > 0)).toBe(true);
        } else {
          shots++;
          expect(
            events.some(
              (e) =>
                e.stage === "setup" &&
                e.id === event.id &&
                e.playerIds.join() === event.playerIds.join(),
            ),
          ).toBe(true);
          expect(
            sequence.actions
              .slice(setup)
              .some(
                (a) =>
                  ["pass", "kickout"].includes(a.kind) &&
                  a.playerId === event.playerIds[0] &&
                  a.targetId === event.playerIds[1],
              ),
          ).toBe(true);
          expect(sequence.actions.at(-1)?.kind).toBe("shoot");
          expect(sequence.shooterId).toBe(event.playerIds[1]);
          expect(definition.zones).toContain(sequence.zone);
          expect(["turnover", "violation"]).not.toContain(sequence.outcome);
        }
      }
    }
    for (const box of [...match.homeBox, ...match.awayBox]) {
      const moves = sequences
        .flatMap((s) => s.moves ?? [])
        .filter((e) => e.playerId === box.playerId);
      const combos = sequences
        .flatMap((s) => s.combos ?? [])
        .filter((e) => e.playerIds.includes(box.playerId));
      for (const id of SIGNATURE_MOVE_IDS)
        expect(box.abilityActivations?.moves?.uses[id] ?? 0).toBe(
          moves.filter((e) => e.move === id).length,
        );
      for (const id of COMBO_IDS) {
        expect(box.abilityActivations?.moves?.combos?.attempts[id] ?? 0).toBe(
          combos.filter((e) => e.id === id && e.stage === "setup").length,
        );
        expect(
          box.abilityActivations?.moves?.combos?.shotsCreated[id] ?? 0,
        ).toBe(combos.filter((e) => e.id === id && e.stage === "shot").length);
      }
      const spent =
        moves.reduce((sum, e) => sum + e.energySpent, 0) +
        combos.reduce(
          (sum, e) => sum + e.energySpent[e.playerIds.indexOf(box.playerId)],
          0,
        );
      expect(box.abilityActivations?.moves?.energySpent ?? 0).toBeCloseTo(
        spent,
        5,
      );
    }
    expect(match.homeBox.reduce((n, b) => n + b.points, 0)).toBe(
      match.homeScore,
    );
    expect(match.awayBox.reduce((n, b) => n + b.points, 0)).toBe(
      match.awayScore,
    );
  }
  expect(signatures).toBeGreaterThan(5);
  expect(setups).toBeGreaterThan(5);
  expect(shots).toBeGreaterThan(0);
});
it("keeps full/compact matches identical and inputs immutable while plans are frozen per game", () => {
  const teams = clubs(),
    source = JSON.stringify(teams);
  const full = simulateMatch(teams[0], teams[1], 81);
  expect(simulateMatch(teams[0], teams[1], 81)).toEqual(full);
  expect({ ...full, insights: undefined }).toEqual(
    simulateMatch(teams[0], teams[1], 81, { collectInsights: false }),
  );
  expect(JSON.stringify(teams)).toBe(source);
});
it("disables combos without chemistry and all moves when abilities are off", () => {
  const teams = clubs(),
    off = teams.map((t) => ({
      ...t,
      engineRules: {
        version: 1 as const,
        abilities: false,
        adaptiveCoaching: true,
        familiarity: 0,
      },
    }));
  const disabled = simulateMatch(off[0], off[1], 81);
  expect(disabled.comboAssignments).toBeUndefined();
  expect(disabled.insights!.court!.every((s) => !s.combos && !s.moves)).toBe(
    true,
  );
  expect(disabled).toEqual(
    simulateMatch(
      { ...off[0], movesetVersion: 1 },
      { ...off[1], movesetVersion: 1 },
      81,
    ),
  );
  const unlinked = simulateMatch(
    {
      ...teams[0],
      chemistryVersion: undefined,
      chemistryGrowthVersion: undefined,
      moraleVersion: undefined,
      personalityVersion: undefined,
      chemistryBonds: undefined,
      morale: undefined,
    },
    {
      ...teams[1],
      chemistryVersion: undefined,
      chemistryGrowthVersion: undefined,
      moraleVersion: undefined,
      personalityVersion: undefined,
      chemistryBonds: undefined,
      morale: undefined,
    },
    81,
  );
  expect(unlinked.comboAssignments).toBeUndefined();
  expect(unlinked.insights!.court!.every((s) => !s.combos)).toBe(true);
});
it("does not leak new-rule rotation targets into an old saved match when rules run in either order", async () => {
  const candidates = [signatureTeam(), ...clubs()].map((t) => ({
    ...t,
    coach: undefined,
  }));
  const target = candidates.find(
    (t) =>
      JSON.stringify(coachRotationMinutes({ ...t, movesetVersion: 1 })) !==
      JSON.stringify(coachRotationMinutes({ ...t, movesetVersion: 2 })),
  );
  expect(
    target,
    "needs a real rotation difference between rule versions",
  ).toBeDefined();
  const opponent = candidates.find((t) => t.id !== target!.id)!;
  vi.resetModules();
  const first = await import("./match");
  const old = first.simulateMatch(
    { ...target!, movesetVersion: 1 },
    { ...opponent, movesetVersion: 1 },
    2026,
  );
  vi.resetModules();
  const second = await import("./match");
  second.simulateMatch(
    { ...target!, movesetVersion: 2 },
    { ...opponent, movesetVersion: 2 },
    2026,
  );
  expect(
    second.simulateMatch(
      { ...target!, movesetVersion: 1 },
      { ...opponent, movesetVersion: 1 },
      2026,
    ),
  ).toEqual(old);
});
it("never records shooting signatures on attacks later cancelled by pressure or non-shooting fouls", () => {
  const teams = clubs();
  let cancelled = 0;
  for (const seed of [7, 42, 81]) {
    const match = simulateMatch(teams[0], teams[1], seed);
    for (const sequence of match.insights!.court!) {
      if (sequence.actions.some((a) => a.kind === "shoot")) continue;
      cancelled++;
      expect(
        (sequence.moves ?? []).filter(
          (e) =>
            SIGNATURE_MOVE_IDS.includes(e.move as any) &&
            ["shoot", "defend"].includes(e.opportunity),
        ),
        `cancelled possession ${sequence.possession}`,
      ).toEqual([]);
    }
  }
  expect(cancelled).toBeGreaterThan(0);
});
