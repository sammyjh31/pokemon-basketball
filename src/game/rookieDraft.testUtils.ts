import { createRun, placePokemon } from "./draft";
import { createLeague } from "./league";
import { initialState } from "./state";
import { ROSTER_SLOTS, type GameState } from "./types";

export function rookieFixture(): GameState {
  let run = createRun("free", false, 82);
  // This fixture represents existing franchises; modern tests opt in explicitly.
  delete run.evaluationVersion;
  delete run.physicalAbilityVersion;
  delete run.chemistryVersion;
  [129, 25, 149, 68, 143, 9, 94, 59].forEach((id, index) => {
    run = placePokemon(run, id, ROSTER_SLOTS[index]);
  });
  const teams = createLeague(run);
  return {
    ...initialState(82),
    run,
    franchise: {
      modelVersion: 3,
      year: 1,
      phase: "offseason",
      teams,
      careers: [],
      trades: [],
      history: [
        {
          year: 1,
          seasonSeed: run.seasonSeed,
          standings: teams.map((team) => ({
            teamId: team.id,
            wins: 20 + team.id,
            losses: 62 - team.id,
            pointsFor: 8200,
            pointsAgainst: 8200,
            homeWins: 10,
            awayWins: 10 + team.id,
            streak: 0,
            lastTen: 5,
          })),
          rosters: teams.map((team) =>
            ROSTER_SLOTS.map((slot) => team.roster[slot]!),
          ),
          awards: [],
          allLeague: [],
          allDefense: [],
          championId: 29,
          runnerUpId: 28,
          runnerUpWins: 2,
          finalsMvp: {
            pokemonId: teams[29].roster.PG!,
            teamId: 29,
            playerId: `29:${teams[29].roster.PG}`,
            score: 1,
            value: "20 PPG",
          },
        },
      ],
      offseasons: [
        { modelVersion: 1, year: 1, players: [], tradeStart: 0, tradeCount: 0 },
      ],
    },
  };
}
