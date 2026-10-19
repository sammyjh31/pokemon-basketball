import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { pairKey } from "./teammateChemistry";
import { createMoveRuntime } from "./matchMoves";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import type { LeagueTeam } from "./types";
export function signatureTeam(): LeagueTeam {
  const roster = {
    PG: 25,
    SG: 65,
    SF: 6,
    PF: 3,
    C: 143,
    B1: 9,
    B2: 212,
    B3: 149,
  };
  const ids = Object.values(roster);
  return {
    ...createLeague(performanceRun())[0],
    roster,
    tactic: "interior",
    movesetVersion: 2,
    abilityMastery: Object.fromEntries(ids.map((id) => [id, 400])),
    chemistryBonds: Object.fromEntries(
      ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [pairKey(a, b), 1200])),
    ),
  };
}
export function signaturePlayer(team: LeagueTeam, id: number) {
  return {
    moves: createMoveRuntime(team, id)!,
    energy: 100,
    box: {
      playerId: `${team.id}:${id}`,
      pokemonId: id,
      teamId: team.id,
      fouls: 0,
      abilityActivations: { offense: 0, support: 0, defense: 0 },
    },
    profile: playerProfile(POKEMON_BY_ID.get(id)!),
  };
}
