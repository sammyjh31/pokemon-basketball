import {
  retainChemistry,
  syncTeamBonds,
  teamsWithChemistry,
  validatePairBonds,
  type ChemistryBanks,
} from "./teammateChemistry";
import type { FranchiseSeason, FranchiseTrade } from "./franchiseTypes";
import type { RookieDraft } from "./rookieDraftTypes";
import type { FreeAgency } from "./freeAgencyTypes";
import { ROSTER_SLOTS, type LeagueTeam, type Run } from "./types";

const fail = (): never => {
  throw new Error(
    "Saved teammate history does not match the completed games and roster transactions.",
  );
};
function sameBanks(actual: LeagueTeam[], expected: LeagueTeam[]) {
  if (actual.length !== expected.length) fail();
  for (const team of actual) {
    const wanted = expected.find((other) => other.id === team.id);
    if (
      !wanted ||
      team.chemistryGrowthVersion !== wanted.chemistryGrowthVersion
    )
      return fail();
    if (
      team.chemistryGrowthVersion === 1 &&
      JSON.stringify(validatePairBonds(team.chemistryBonds ?? {})) !==
        JSON.stringify(validatePairBonds(wanted.chemistryBonds ?? {}))
    )
      fail();
  }
}
function finalBanks(value: unknown, teams: LeagueTeam[]): ChemistryBanks {
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
    teams.map((team) => [team.id, validatePairBonds(source[team.id])]),
  );
}

/** Reconcile provenance using verified archive results and validated transaction order. */
export function verifyChemistryChronology(
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
  const replace = (teamId: number, outgoing: number[], incoming: number[]) => {
    if (!expected) return;
    const team = expected.find((item) => item.id === teamId)!;
    const roster = { ...team.roster };
    outgoing.forEach((id, index) => {
      const slot = ROSTER_SLOTS.find((key) => team.roster[key] === id);
      if (!slot) return fail();
      roster[slot] = incoming[index];
    });
    expected = expected.map((item) =>
      item.id === teamId ? { ...item, roster } : item,
    );
  };
  const trade = (item: FranchiseTrade) => {
    const give = item.giveIds ?? [item.giveId],
      receive = item.receiveIds ?? [item.receiveId];
    replace(item.fromTeamId ?? 0, give, receive);
    replace(item.teamId, receive, give);
    if (expected) expected = syncTeamBonds(expected);
  };
  const boundary = (initial: LeagueTeam[]): LeagueTeam[] => {
    if (initial[0].chemistryGrowthVersion !== 1) {
      if (expected?.some((team) => team.chemistryGrowthVersion === 1)) fail();
      return initial;
    }
    return expected
      ? syncTeamBonds(expected).map(retainChemistry)
      : initial.map((team) => ({ ...team, chemistryBonds: {} }));
  };
  for (const archived of history) {
    const initial = archived.replay?.teams;
    if (initial) {
      sameBanks(initial, boundary(initial));
      if (initial[0].chemistryGrowthVersion === 1) {
        expected = teamsWithChemistry(
          initial,
          finalBanks(archived.replay!.playoffs.chemistryBonds, initial),
        );
      } else expected = initial;
    } else {
      if (expected?.some((team) => team.chemistryGrowthVersion === 1)) fail();
      expected = undefined;
    }
    let yearEnd = tradeIndex;
    while (trades[yearEnd]?.year === archived.year) yearEnd++;
    const draft = drafts?.find((item) => item.year === archived.year);
    if (draft) {
      while (tradeIndex < draft.tradeIndex) trade(trades[tradeIndex++]);
      for (const pick of draft.picks) {
        replace(pick.teamId, [pick.releasedId], [pick.pokemonId]);
        if (expected) expected = syncTeamBonds(expected);
      }
    }
    for (const signing of freeAgency?.transactions.filter(
      (item) => item.year === archived.year,
    ) ?? []) {
      while (tradeIndex < signing.tradeIndex) trade(trades[tradeIndex++]);
      replace(signing.teamId, [signing.releasedId], [signing.pokemonId]);
      if (expected) expected = syncTeamBonds(expected);
    }
    while (tradeIndex < yearEnd) trade(trades[tradeIndex++]);
  }
  if (phase === "season") {
    if (!run.leagueTeams) return fail();
    const start = boundary(run.leagueTeams);
    sameBanks(run.leagueTeams, start);
    sameBanks(teams, start);
  } else {
    if (teams[0].chemistryGrowthVersion === 1 && !expected) fail();
    if (expected) sameBanks(teams, expected);
    const initial = history.at(-1)?.replay?.teams;
    if (run.leagueTeams && initial) sameBanks(run.leagueTeams, initial);
  }
}
