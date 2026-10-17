import {
  retainMorale,
  teamsWithMorale,
  validateMoraleRoster,
  withRosterMorale,
  type MoraleBanks,
} from "./playerMorale";
import type { FranchiseSeason, FranchiseTrade } from "./franchiseTypes";
import type { RookieDraft } from "./rookieDraftTypes";
import type { FreeAgency } from "./freeAgencyTypes";
import { ROSTER_SLOTS, type LeagueTeam, type Run } from "./types";

const fail = (): never => {
  throw new Error(
    "Saved player morale does not match the completed games and roster transactions.",
  );
};
function sameBanks(actual: LeagueTeam[], expected: LeagueTeam[]) {
  if (actual.length !== expected.length) fail();
  for (const team of actual) {
    const wanted = expected.find((other) => other.id === team.id);
    if (
      !wanted ||
      team.moraleVersion !== wanted.moraleVersion ||
      team.personalityVersion !== wanted.personalityVersion
    )
      return fail();
    if (
      team.moraleVersion === 1 &&
      JSON.stringify(validateMoraleRoster(team.morale, team)) !==
        JSON.stringify(validateMoraleRoster(wanted.morale, wanted))
    )
      fail();
  }
}
function finalBanks(value: unknown, teams: LeagueTeam[]): MoraleBanks {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== teams.length
  )
    return fail();
  const source = value as Record<string, unknown>;
  if (
    Object.keys(source).some(
      (id) => !teams.some((team) => String(team.id) === id),
    )
  )
    fail();
  return Object.fromEntries(
    teams.map((team) => [team.id, validateMoraleRoster(source[team.id], team)]),
  );
}

/** Verified game results anchor every subsequent identity-only transaction and seasonal reset. */
export function verifyMoraleChronology(
  run: Run,
  teams: LeagueTeam[],
  history: FranchiseSeason[],
  trades: FranchiseTrade[],
  drafts: RookieDraft[] | undefined,
  freeAgency: FreeAgency | undefined,
  phase: "season" | "offseason",
) {
  let expected: LeagueTeam[] | undefined;
  let tradeIndex = 0;
  const replace = (
    teamId: number,
    outgoing: number[],
    incoming: number[],
    kind: "trade" | "rookie" | "free-agent",
    sources = expected,
  ) => {
    if (!expected || !sources) return;
    const team = sources.find((item) => item.id === teamId);
    if (!team) return fail();
    const roster = { ...team.roster };
    outgoing.forEach((id, index) => {
      const slot = ROSTER_SLOTS.find((key) => team.roster[key] === id);
      if (!slot) return fail();
      roster[slot] = incoming[index];
    });
    const updated = withRosterMorale({ ...team, roster }, team, sources, kind);
    expected = expected.map((item) => (item.id === teamId ? updated : item));
  };
  const trade = (item: FranchiseTrade) => {
    const give = item.giveIds ?? [item.giveId],
      receive = item.receiveIds ?? [item.receiveId];
    // Both clubs receive the original donor state, before either side is changed.
    const sources = expected;
    replace(item.fromTeamId ?? 0, give, receive, "trade", sources);
    replace(item.teamId, receive, give, "trade", sources);
  };
  const boundary = (initial: LeagueTeam[]): LeagueTeam[] => {
    const personalityVersion = initial[0].personalityVersion;
    if (
      (personalityVersion !== undefined && personalityVersion !== 1) ||
      initial.some((team) => team.personalityVersion !== personalityVersion) ||
      (personalityVersion === 1 && initial[0].moraleVersion !== 1) ||
      (personalityVersion !== 1 &&
        expected?.some((team) => team.personalityVersion === 1))
    )
      fail();
    if (initial[0].moraleVersion !== 1) {
      if (expected?.some((team) => team.moraleVersion === 1)) fail();
      return initial;
    }
    return expected
      ? expected.map((team) => ({
          ...retainMorale(team),
          ...(personalityVersion === 1
            ? { personalityVersion: 1 as const }
            : {}),
        }))
      : initial.map((team) =>
          retainMorale({
            ...team,
            moraleVersion: undefined,
            morale: undefined,
          }),
        );
  };
  for (const archived of history) {
    const initial = archived.replay?.teams;
    if (initial) {
      sameBanks(initial, boundary(initial));
      expected =
        initial[0].moraleVersion === 1
          ? teamsWithMorale(
              initial,
              finalBanks(archived.replay!.playoffs.morale, initial),
            )
          : initial;
    } else {
      if (expected?.some((team) => team.moraleVersion === 1)) fail();
      expected = undefined;
    }
    let yearEnd = tradeIndex;
    while (trades[yearEnd]?.year === archived.year) yearEnd++;
    const draft = drafts?.find((item) => item.year === archived.year);
    if (draft) {
      while (tradeIndex < draft.tradeIndex) trade(trades[tradeIndex++]);
      for (const pick of draft.picks)
        replace(pick.teamId, [pick.releasedId], [pick.pokemonId], "rookie");
    }
    for (const signing of freeAgency?.transactions.filter(
      (item) => item.year === archived.year,
    ) ?? []) {
      while (tradeIndex < signing.tradeIndex) trade(trades[tradeIndex++]);
      replace(
        signing.teamId,
        [signing.releasedId],
        [signing.pokemonId],
        "free-agent",
      );
    }
    while (tradeIndex < yearEnd) trade(trades[tradeIndex++]);
  }
  if (phase === "season") {
    if (!run.leagueTeams) return fail();
    const start = boundary(run.leagueTeams);
    sameBanks(run.leagueTeams, start);
    sameBanks(teams, start);
  } else {
    if (teams[0].moraleVersion === 1 && !expected) fail();
    if (expected) sameBanks(teams, expected);
    const initial = history.at(-1)?.replay?.teams;
    if (run.leagueTeams && initial) sameBanks(run.leagueTeams, initial);
  }
}
