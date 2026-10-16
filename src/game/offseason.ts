import { developPlayer } from "./development";
import {
  DEVELOPMENT_SKILLS,
  CPU_TRADE_LIMIT,
  type PlayerDevelopment,
} from "./developmentTypes";
import { FRANCHISE_MAX_TRADES } from "./franchiseTypes";
import { teamRatings } from "./ratings";
import { validateLeagueTeams } from "./franchiseValidation";
import { cpuTrades } from "./rosterTrades";
import { ROSTER_SLOTS, type GameState } from "./types";
export { developPlayer } from "./development";

/** One deterministic transaction: train the league, then let CPU clubs negotiate. */
export function processOffseason(state: GameState): GameState {
  const f = state.franchise,
    league = state.run.result?.league;
  if (
    !f ||
    f.phase !== "offseason" ||
    !league ||
    f.history.length !== f.year ||
    f.history.at(-1)?.seasonSeed !== state.run.seasonSeed ||
    state.run.playoffs?.championId == null ||
    f.offseasons?.some((r) => r.year === f.year)
  )
    return state;
  if (f.modelVersion === 2 && f.offseasons?.at(-1)?.year !== f.year - 1)
    return state;
  const teams = validateLeagueTeams(f.teams, state.run.includeLegends);
  const old: PlayerDevelopment = Object.assign(
    {},
    ...teams.map((t) => t.development),
  );
  const players = league.players.map((player) =>
    developPlayer(
      player,
      old[player.pokemonId] ?? {},
      f.year,
      state.run.seasonSeed,
    ),
  );
  const next: PlayerDevelopment = {};
  for (const row of players) {
    const changes = { ...(old[row.pokemonId] ?? {}) };
    for (const skill of DEVELOPMENT_SKILLS) {
      const value = (changes[skill] ?? 0) + (row.changes[skill] ?? 0);
      if (value) changes[skill] = value;
      else delete changes[skill];
    }
    next[row.pokemonId] = changes;
  }
  const developed = teams.map((team) => {
    const development = Object.fromEntries(
      ROSTER_SLOTS.map((slot) => [
        team.roster[slot]!,
        next[team.roster[slot]!],
      ]),
    );
    return {
      ...team,
      development,
      ratings: teamRatings(
        team.roster,
        team.tactic,
        team.rotation,
        development,
      ),
    };
  });
  const activity = cpuTrades(
    developed,
    f.year,
    state.run.seasonSeed,
    Math.min(
      CPU_TRADE_LIMIT,
      Math.max(0, FRANCHISE_MAX_TRADES - f.trades.length),
    ),
  );
  return {
    ...state,
    franchise: {
      ...f,
      modelVersion: 2,
      teams: activity.teams,
      trades: [...f.trades, ...activity.trades],
      offseasons: [
        ...(f.offseasons ?? []),
        {
          modelVersion: 1,
          year: f.year,
          players,
          tradeStart: f.trades.length,
          tradeCount: activity.trades.length,
        },
      ],
    },
  };
}
