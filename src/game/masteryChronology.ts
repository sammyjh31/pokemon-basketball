import { syncTeamBonds, teamsWithChemistry } from "./teammateChemistry";
import {
  retainMastery,
  teamsWithMastery,
  validateMasteryRoster,
  withRosterMastery,
  trainMastery,
  type MasteryBanks,
  type MasteryRoster,
} from "./abilityMastery";
import type { FranchiseSeason, FranchiseTrade } from "./franchiseTypes";
import type { RookieDraft } from "./rookieDraftTypes";
import type { FreeAgency } from "./freeAgencyTypes";
import type { OffseasonReport } from "./developmentTypes";
import { ROSTER_SLOTS, type LeagueTeam, type Run } from "./types";
const fail = (): never => {
  throw new Error(
    "Saved ability mastery does not match completed games, training and roster transactions.",
  );
};
function sameBanks(actual: LeagueTeam[], expected: LeagueTeam[]) {
  if (actual.length !== expected.length) fail();
  for (const team of actual) {
    const wanted = expected.find((other) => other.id === team.id);
    if (!wanted || team.abilityMasteryVersion !== wanted.abilityMasteryVersion)
      return fail();
    if (
      team.abilityMasteryVersion === 1 &&
      JSON.stringify(validateMasteryRoster(team.abilityMastery, team)) !==
        JSON.stringify(validateMasteryRoster(wanted.abilityMastery, wanted))
    )
      fail();
  }
}
function finalBanks(value: unknown, teams: LeagueTeam[]): MasteryBanks {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== teams.length ||
    Object.keys(value).some((id) => !teams.some((t) => String(t.id) === id))
  )
    return fail();
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    teams.map((team) => [
      team.id,
      validateMasteryRoster(source[team.id], team),
    ]),
  );
}
/** Verified game boxes and deterministic camp reports anchor all later ownership changes. */
export function verifyMasteryChronology(
  run: Run,
  teams: LeagueTeam[],
  history: FranchiseSeason[],
  trades: FranchiseTrade[],
  drafts: RookieDraft[] | undefined,
  freeAgency: FreeAgency | undefined,
  phase: "season" | "offseason",
  reports: OffseasonReport[] | undefined,
) {
  let expected: LeagueTeam[] | undefined,
    tradeIndex = 0;
  const released: MasteryRoster = {};
  const replace = (
    teamId: number,
    outgoing: number[],
    incoming: number[],
    kind: "trade" | "rookie" | "free-agent",
    sources = expected,
  ) => {
    if (!expected || !sources) return;
    const team = sources.find((t) => t.id === teamId);
    if (!team) return fail();
    const roster = { ...team.roster };
    outgoing.forEach((id, index) => {
      const slot = ROSTER_SLOTS.find((s) => team.roster[s] === id);
      if (!slot) return fail();
      roster[slot] = incoming[index];
      if (kind !== "trade") released[id] = team.abilityMastery?.[id] ?? 0;
    });
    const updated = withRosterMastery(
      { ...team, roster },
      team,
      sources,
      kind,
      released,
    );
    expected = expected.map((t) => (t.id === teamId ? updated : t));
  };
  const trade = (item: FranchiseTrade) => {
    const give = item.giveIds ?? [item.giveId],
      receive = item.receiveIds ?? [item.receiveId],
      sources = expected;
    replace(item.fromTeamId ?? 0, give, receive, "trade", sources);
    replace(item.teamId, receive, give, "trade", sources);
    if (expected?.[0].movesetVersion === 2) expected = syncTeamBonds(expected);
  };
  const boundary = (initial: LeagueTeam[]): LeagueTeam[] => {
    if (initial[0].abilityMasteryVersion !== 1) {
      if (expected?.some((t) => t.abilityMasteryVersion === 1)) fail();
      return initial;
    }
    return expected
      ? expected.map((t) => retainMastery({ ...t, abilityVersion: 1 as const }))
      : initial.map((t) =>
          retainMastery({
            ...t,
            abilityMasteryVersion: undefined,
            abilityMastery: undefined,
          }),
        );
  };
  for (const archived of history) {
    const initial = archived.replay?.teams;
    if (initial) {
      sameBanks(initial, boundary(initial));
      expected =
        initial[0].abilityMasteryVersion === 1
          ? teamsWithMastery(
              initial,
              finalBanks(archived.replay!.playoffs.abilityMastery, initial),
            )
          : initial;
      // V2 partnership practice must use the same verified, earned familiarity as camp.
      // Chemistry chronology independently validates this final bank.
      if (initial[0].movesetVersion === 2)
        expected = teamsWithChemistry(
          expected,
          archived.replay!.playoffs.chemistryBonds,
        );
    } else {
      if (expected?.some((t) => t.abilityMasteryVersion === 1)) fail();
      expected = undefined;
    }
    let yearEnd = tradeIndex;
    while (trades[yearEnd]?.year === archived.year) yearEnd++;
    const report = reports?.find((r) => r.year === archived.year);
    if (report) {
      while (tradeIndex < report.tradeStart) trade(trades[tradeIndex++]);
      if (expected?.[0].abilityMasteryVersion === 1) {
        const assignments = Object.fromEntries(
          report.players
            .filter((p) => p.training)
            .map((p) => [p.pokemonId, p.training!]),
        );
        const results = expected.map((t) =>
          trainMastery(t, assignments, archived.year, archived.seasonSeed),
        );
        if (
          JSON.stringify(report.mastery) !==
          JSON.stringify(results.flatMap((r) => r.changes))
        )
          fail();
        expected = expected.map((t, i) => ({
          ...t,
          abilityMastery: results[i].mastery,
        }));
      } else if (report.mastery !== undefined) fail();
    }
    const draft = drafts?.find((d) => d.year === archived.year);
    if (draft) {
      while (tradeIndex < draft.tradeIndex) trade(trades[tradeIndex++]);
      for (const pick of draft.picks)
        replace(pick.teamId, [pick.releasedId], [pick.pokemonId], "rookie");
    }
    for (const signing of freeAgency?.transactions.filter(
      (t) => t.year === archived.year,
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
    if (teams[0].abilityMasteryVersion === 1 && !expected) fail();
    if (expected) sameBanks(teams, expected);
    const initial = history.at(-1)?.replay?.teams;
    if (run.leagueTeams && initial) sameBanks(run.leagueTeams, initial);
  }
}
