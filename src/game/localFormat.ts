import { FRANCHISE_POKEMON } from "../data/pokemon";
import type { EngineRules } from "./engineInsightsTypes";
export interface LocalFormat {
  teamCount: 4 | 8 | 16 | 30;
  gamesPerTeam: 14 | 28 | 82;
  playoffTeams: 4 | 8 | 16;
  bestOf: 1 | 3 | 5 | 7;
}
export interface LocalLeagueOptions {
  mode: "generational" | "full-pool";
  format: LocalFormat;
  engineRules: EngineRules;
}
export const LOCAL_DEFAULT_OPTIONS: LocalLeagueOptions = {
  mode: "generational",
  format: { teamCount: 8, gamesPerTeam: 28, playoffTeams: 8, bestOf: 3 },
  engineRules: {
    version: 1,
    abilities: true,
    adaptiveCoaching: true,
    familiarity: 0,
  },
};
export const LOCAL_MAX_YEARS = 50;
export const localGeneration = (id: number) =>
  [151, 251, 386, 493, 649, 721, 809, 905, 1025].findIndex(
    (last) => id <= last,
  ) + 1;
export function validateLocalFormat(value: LocalFormat): LocalFormat {
  if (
    !value ||
    ![4, 8, 16, 30].includes(value.teamCount) ||
    ![14, 28, 82].includes(value.gamesPerTeam) ||
    ![4, 8, 16].includes(value.playoffTeams) ||
    value.playoffTeams > value.teamCount ||
    ![1, 3, 5, 7].includes(value.bestOf)
  )
    throw new Error("Choose a supported local league format.");
  return {
    teamCount: value.teamCount,
    gamesPerTeam: value.gamesPerTeam,
    playoffTeams: value.playoffTeams,
    bestOf: value.bestOf,
  };
}
export function validateLocalOptions(
  value: LocalLeagueOptions,
  includeLegends: boolean,
): LocalLeagueOptions {
  if (!value || !["generational", "full-pool"].includes(value.mode))
    throw new Error("Choose a local franchise mode.");
  const format = validateLocalFormat(value.format),
    rules = value.engineRules;
  if (
    !rules ||
    rules.version !== 1 ||
    typeof rules.abilities !== "boolean" ||
    typeof rules.adaptiveCoaching !== "boolean" ||
    typeof rules.familiarity !== "number" ||
    !Number.isFinite(rules.familiarity) ||
    rules.familiarity < 0 ||
    rules.familiarity > 1
  )
    throw new Error("Invalid local engine rules.");
  if (
    FRANCHISE_POKEMON.filter(
      (p) =>
        (value.mode === "full-pool" || p.id <= 151) &&
        (includeLegends || !p.legendary),
    ).length <
    format.teamCount * 8
  )
    throw new Error(
      "Generation I supports at most 16 clubs with eight unique players per club.",
    );
  return {
    mode: value.mode,
    format,
    engineRules: {
      version: 1,
      abilities: rules.abilities,
      adaptiveCoaching: rules.adaptiveCoaching,
      familiarity: rules.familiarity,
    },
  };
}
