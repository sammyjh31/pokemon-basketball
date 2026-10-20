import { expect, it } from "vitest";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { simulateMatch } from "./match";
import { recordScouting, scoutingForMatch } from "./opponentScouting";
import { seedCoachScouting, initialSeasonScouting } from "./scoutingContinuity";
import { captureCoachBook } from "./coachScoutingArchive";
import { localSeasonBuilder } from "./localSeason";
import { simulatePlayoffs } from "./playoffs";
import { seasonBuilder } from "./season";
it("seeds every regular/CPU/partial fixture and standalone match from the same annual evidence", () => {
  const run = { ...performanceRun(), movesetVersion: 3 as const };
  const teams = createLeague(run);
  const previous = localSeasonBuilder(
    teams.slice(0, 4),
    { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
    12,
  );
  previous.fixtures.forEach(previous.play);
  const league = previous.finish().league!,
    playoffs = simulatePlayoffs(league, 12),
    book = captureCoachBook(league, playoffs, 1)!;
  const next = seedCoachScouting(
    [{ year: 1, coachBook: book }],
    teams.slice(0, 4),
    2,
  );
  const context = scoutingForMatch(initialSeasonScouting(next), 0, 1);
  const direct = simulateMatch(next[0], next[1], 1982);
  expect(direct.counterPlans!.home.length).toBeGreaterThan(0);
  expect(direct).toEqual(
    simulateMatch(next[0], next[1], 1982, { scouting: context }),
  );
  const newYear = localSeasonBuilder(next, league.format!, 13);
  newYear.fixtures.forEach(newYear.play);
  expect(newYear.finish().league!.games[0].scouting!.home.carried).toBe(1);
  const all = seedCoachScouting(
    [
      {
        year: 1,
        coachBook: {
          ...book,
          teams: teams.map((t) => ({
            id: t.id,
            roster: Object.values(t.roster) as number[],
            coachId: t.coach!.id,
          })),
        },
      },
    ],
    teams,
    2,
  );
  const round = seasonBuilder({ ...run, leagueTeams: all }, 1);
  round.fixtures.forEach(round.play);
  expect(round.finish().league!.scouting!["0:1"].carried).toBe(1);
});
