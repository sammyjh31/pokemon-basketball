import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
function teams() {
  const run = createRun("free", true, 112);
  run.coach = { version: 1, id: "misty" };
  run.roster = {
    PG: 65,
    SG: 135,
    SF: 68,
    PF: 95,
    C: 113,
    B1: 92,
    B2: 52,
    B3: 25,
  };
  return createLeague(run);
}
it("uses actual active-five chemistry in all simulated games and preserves compact results", () => {
  const [h, a] = teams(),
    game = simulateMatch(h, a, 112);
  const rows = game.insights!.lineups;
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((r) => r.chemistry && r.chemistryContext)).toBe(true);
  expect(rows.some((r) => r.chemistry!.links.length > 0)).toBe(true);
  for (const row of rows)
    for (const link of row.chemistry!.links)
      expect(
        link.pokemonIds.every((id) =>
          row.playerIds.includes(`${row.teamId}:${id}`),
        ),
      ).toBe(true);
  const compact = simulateMatch(h, a, 112, { collectInsights: false });
  expect(compact.homeBox).toEqual(game.homeBox);
  expect(compact.awayBox).toEqual(game.awayBox);
  const old = simulateMatch(
    { ...h, chemistryVersion: undefined },
    { ...a, chemistryVersion: undefined },
    112,
  );
  expect(old.insights!.lineups.every((r) => r.chemistry === undefined)).toBe(
    true,
  );
  expect(game.homeBox).not.toEqual(old.homeBox);
  expect(game.homeBox.reduce((n, b) => n + b.points, 0)).toBe(game.homeScore);
});
it("retains ordinary chemistry without ability combinations and rejects mixed rules", () => {
  const [h, a] = teams();
  for (const t of [h, a])
    t.engineRules = {
      version: 1,
      abilities: false,
      adaptiveCoaching: false,
      familiarity: 0,
    };
  const game = simulateMatch(h, a, 23);
  expect(
    game.insights!.lineups.every(
      (r) => r.chemistry && r.chemistry.links.length === 0,
    ),
  ).toBe(true);
  expect(() =>
    simulateMatch(h, { ...a, chemistryVersion: undefined }, 23),
  ).toThrow(/chemistry/);
});

it("keeps scheme-dependent chemistry separate when aggregating season lineups", async () => {
  const { buildSeasonInsights } = await import("./insightAnalysis");
  const { insightLeague, insightMatch } =
    await import("./insightAnalysis.testUtils");
  const [h, a] = teams();
  const chemistry = simulateMatch(h, a, 11).insights!.lineups[0].chemistry!;
  const data = await buildSeasonInsights(insightLeague(2), {
    resolveMatch: () => {
      const match = insightMatch(),
        row = match.insights!.lineups[0];
      match.insights!.lineups = [
        {
          ...row,
          chemistry,
          chemistryContext: { tactic: "pace", defense: "man" },
        },
        {
          ...row,
          chemistry,
          chemistryContext: { tactic: "interior", defense: "zone" },
        },
      ];
      return match;
    },
  });
  expect(data.lineups).toHaveLength(2);
  expect(data.lineups.map((r) => r.chemistryContext!.tactic).sort()).toEqual([
    "interior",
    "pace",
  ]);
  expect(
    data.lineups.every(
      (r) => r.games === 2 && r.seconds === 1200 && r.chemistry === chemistry,
    ),
  ).toBe(true);
});
