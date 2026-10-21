import { trainMastery } from "./abilityMastery";
import { coachTrainingPlans } from "./coachTraining";
import { cpuMarketTrades } from "./tradeMarket";
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
  if (f.offseasons?.length && f.offseasons.at(-1)?.year !== f.year - 1)
    return state;
  const teams = validateLeagueTeams(f.teams, state.run.includeLegends);
  const old: PlayerDevelopment = Object.assign(
    {},
    ...teams.map((t) => t.development),
  );
  const assignments = Object.assign(
    {},
    ...teams.map((team) => coachTrainingPlans(team, league.players)),
  ) as ReturnType<typeof coachTrainingPlans>;
  // The season that was just played decides the development rules (court version 3: balanced).
  const balanced = (league.teams[0]?.courtVersion ?? 0) >= 3,
    reportVersion = balanced ? (2 as const) : (1 as const);
  const players = league.players.map((player) => ({
    ...developPlayer(
      player,
      old[player.pokemonId] ?? {},
      f.year,
      state.run.seasonSeed,
      assignments[player.pokemonId]?.plan ??
        f.trainingPlans?.[player.pokemonId],
      balanced,
      teams[player.teamId].shinySeed,
    ),
    ...(assignments[player.pokemonId]
      ? { training: assignments[player.pokemonId] }
      : {}),
  }));
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
  const mastery: import("./abilityMastery").MasteryTrainingChange[] = [];
  const developed = teams.map((team) => {
    const trained = trainMastery(
      team,
      assignments,
      f.year,
      state.run.seasonSeed,
    );
    if (team.abilityMasteryVersion === 1) mastery.push(...trained.changes);
    const development = Object.fromEntries(
      ROSTER_SLOTS.map((slot) => [
        team.roster[slot]!,
        next[team.roster[slot]!],
      ]),
    );
    return {
      ...team,
      ...(team.abilityMasteryVersion === 1
        ? { abilityMastery: trained.mastery }
        : {}),
      development,
      ratings: teamRatings(
        team.roster,
        team.tactic,
        team.rotation,
        development,
        team.rotationPlan,
        team.shinySeed,
      ),
    };
  });
  const limit = Math.min(
    CPU_TRADE_LIMIT,
    Math.max(0, FRANCHISE_MAX_TRADES - f.trades.length),
  );
  const activity =
    f.modelVersion === 3
      ? cpuMarketTrades(
          {
            ...f,
            teams: developed,
            offseasons: [
              ...(f.offseasons ?? []),
              {
                modelVersion: reportVersion,
                year: f.year,
                players,
                ...(mastery.length ? { mastery } : {}),
                tradeStart: f.trades.length,
                tradeCount: 0,
              },
            ],
          },
          limit,
        )
      : cpuTrades(developed, f.year, state.run.seasonSeed, limit);
  return {
    ...state,
    franchise: {
      ...f,
      modelVersion: f.modelVersion === 3 ? 3 : 2,
      teams: activity.teams,
      trades: [...f.trades, ...activity.trades],
      offseasons: [
        ...(f.offseasons ?? []),
        {
          modelVersion: reportVersion,
          year: f.year,
          players,
          ...(mastery.length ? { mastery } : {}),
          tradeStart: f.trades.length,
          tradeCount: activity.trades.length,
        },
      ],
    },
  };
}
