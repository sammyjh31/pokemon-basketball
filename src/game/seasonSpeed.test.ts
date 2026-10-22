import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import * as evaluation from "./teamEvaluation";
import * as morale from "./playerMorale";
import { createLeague } from "./league";
import { currentPerformanceRun } from "./seasonPerformance.testUtils";
import { evaluateLineupChemistry } from "./lineupChemistry";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import { TACTICS, DEFENSE_SCHEMES } from "./types";
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
it("builds the same CPU league without formatting unused scouting reports", () => {
  const reports = vi.spyOn(evaluation, "evaluatePlayer");
  try {
    const teams = createLeague(currentPerformanceRun());
    expect(digest(teams)).toBe(
      "0292c31c06a13cf77a9ab97bb4c98a8e4fff6c49fe1713d8bbf4dd4b726c0db7",
    );
    expect(reports.mock.calls.length).toBe(0);
  } finally {
    reports.mockRestore();
  }
});
it("reads the pregame morale snapshot once when comparing projected units", () => {
  const snapshots = vi.spyOn(morale, "moraleScores");
  try {
    const team = {
      ...currentPerformanceRun(),
      morale: {
        65: { score: 75, minutes: 30, success: 55, disruption: 0, games: 5 },
      },
    };
    evaluation.projectedLineupChemistry(team, {
      tactic: "balanced",
      defense: "man",
    });
    expect(snapshots).toHaveBeenCalledTimes(1);
  } finally {
    snapshots.mockRestore();
  }
});
it("preserves complete chemistry reports including tied donors, abilities, bonds, morale and reordered units", () => {
  const outputs = [];
  for (const ids of [
    [65, 63, 68, 95, 113],
    [311, 312, 26, 6, 143],
    [3, 6, 9, 25, 94],
    [130, 149, 131, 68, 65],
  ]) {
    for (const equalSkills of [false, true]) {
      const floor = ids.map((pokemonId) => ({
        pokemonId,
        profile: structuredClone(playerProfile(POKEMON_BY_ID.get(pokemonId)!)),
      }));
      if (equalSkills)
        for (const p of floor) p.profile = structuredClone(floor[0].profile);
      for (const tactic of TACTICS)
        for (const defense of DEFENSE_SCHEMES)
          for (const abilities of [false, true]) {
            const context = {
              tactic,
              defense,
              abilities,
              bonds: { "63:65": 480, "311:312": 120 },
              morale: { 65: 90, 68: 20 },
              leadership: {
                captainId: ids[0],
                style: "Organizer" as const,
                cohesionBonus: 1.5,
                score: 70,
                moraleSupport: 1,
                reasons: [],
              },
            };
            const report = evaluateLineupChemistry(floor, context);
            expect(
              evaluateLineupChemistry([...floor].reverse(), context),
            ).toEqual(report);
            outputs.push(report);
          }
    }
  }
  expect(digest(outputs)).toBe(
    "6747f64fe64067b42f0d6789def3a972fff4e0d1b4a60f13dcf8078079e16cb0",
  );
});
