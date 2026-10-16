import { expect, it } from "vitest";
import { teamRatings } from "./ratings";
import { createRivalStrategy } from "./rivalRosterStrategy";
import { ROSTER_SLOTS, type LeagueTeam } from "./types";
import type { RivalHistory } from "./rivalScoutingTypes";
const rosterIds = [52, 53, 113, 115, 128, 132, 133, 143];
function team(id: number, ids = rosterIds): LeagueTeam {
  const roster = Object.fromEntries(
    ROSTER_SLOTS.map((s, i) => [s, ids[i]]),
  ) as LeagueTeam["roster"];
  return {
    id,
    name: `Club ${id}`,
    roster,
    tactic: "balanced",
    rotation: "balanced",
    defense: "man",
    ratings: teamRatings(roster, "balanced", "balanced"),
  };
}
function history(year = 1, threat = 25): RivalHistory {
  return {
    year,
    rivalScouting: {
      version: 1,
      teams: {
        0: [
          {
            teamId: 1,
            games: 6,
            losses: 5,
            playoffGames: 3,
            threats: [
              {
                pokemonId: threat,
                attempts: 40,
                points: 60,
                rimAttempts: 20,
                threeAttempts: 15,
              },
            ],
          },
        ],
      },
    },
  };
}
it("values counters to the observed rival and exposes the concrete threat", () => {
  const a = team(0),
    b = team(1, [25, 1, 2, 3, 4, 5, 6, 7]);
  const plan = createRivalStrategy(a, [a, b], [history()], 1);
  expect(plan.active).toBe(true);
  expect(plan.playerValue(95)).toBeGreaterThan(plan.playerValue(130));
  expect(plan.change([52], [95])).toBeGreaterThan(0);
  expect(plan.explanation).toContain("Club 1");
  expect(plan.explanation).toContain("Pikachu");
  expect(plan.rivals[0].threatIds).toEqual([25]);
});
it("reverses recruiting priorities when a different rival threat is observed", () => {
  const a = team(0),
    b = team(1, [130, 1, 2, 3, 4, 5, 6, 7]);
  const plan = createRivalStrategy(a, [a, b], [history(1, 130)], 1);
  expect(plan.playerValue(135)).toBeGreaterThan(plan.playerValue(95));
});
it("learns only from that club's past and ignores departed threats", () => {
  const a = team(0),
    b = team(1, [25, 1, 2, 3, 4, 5, 6, 7]);
  expect(createRivalStrategy(a, [a, b], [history(2)], 1).active).toBe(false);
  expect(createRivalStrategy(b, [a, b], [history()], 1).active).toBe(false);
  expect(createRivalStrategy(a, [a, team(1)], [history()], 1).active).toBe(
    false,
  );
  expect(createRivalStrategy(a, [a, b], [history()], 4).active).toBe(false);
});
it("decays older evidence and avoids collecting redundant counters", () => {
  const a = team(0),
    b = team(1, [25, 1, 2, 3, 4, 5, 6, 7]);
  const fresh = createRivalStrategy(a, [a, b], [history(3)], 3);
  const old = createRivalStrategy(a, [a, b], [history(1)], 3);
  expect(old.change([52], [95])).toBeGreaterThan(0);
  expect(old.change([52], [95])).toBeLessThan(fresh.change([52], [95]));
  const covered = team(0, [95, 111, 112, 115, 128, 132, 133, 143]);
  expect(
    createRivalStrategy(covered, [covered, b], [history(3)], 3).change(
      [143],
      [28],
    ),
  ).toBeLessThan(fresh.change([52], [95]));
  expect(
    Math.abs(fresh.change(rosterIds, [95, 111, 112, 28, 27, 104, 105, 76])),
  ).toBeLessThanOrEqual(3);
});
it("keeps history and rosters immutable and is deterministic", () => {
  const teams = [team(0), team(1, [25, 1, 2, 3, 4, 5, 6, 7])],
    h = [history()],
    before = structuredClone({ teams, h });
  const a = createRivalStrategy(teams[0], teams, h, 1),
    b = createRivalStrategy(teams[0], teams, h, 1);
  expect(a.change([52], [95])).toBe(b.change([52], [95]));
  expect({ teams, h }).toEqual(before);
  expect(createRivalStrategy(teams[0], teams, [], 1).change([52], [95])).toBe(
    0,
  );
});

it("does not buy a counter to a threat acquired from the trading rival", () => {
  const a = team(0),
    b = team(1, [25, 1, 2, 3, 4, 5, 6, 7]);
  const plan = createRivalStrategy(a, [a, b], [history()], 1);
  expect(plan.tradeChange([52], [25], 1)).toBe(0);
  expect(plan.tradeChange([52], [95], 1)).toBe(plan.change([52], [95]));
});
