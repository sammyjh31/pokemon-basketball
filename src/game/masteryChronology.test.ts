import { expect, it } from "vitest";
import { verifyMasteryChronology } from "./masteryChronology";
import { createRun } from "./draft";
import { createLeague } from "./league";
import {
  initialMasteryBanks,
  teamsWithMastery,
  trainMastery,
  retainMastery,
} from "./abilityMastery";
import { coachTrainingPlans } from "./coachTraining";
import { exchangePlayers } from "./rosterTrades";
import { rookieFixture } from "./rookieDraft.testUtils";
import { appointFranchiseCoach } from "./coachFranchise";
import { assignLeagueCoaches, COACHES } from "./trainerCoaches";
import { projectedCoaches } from "./coachOffice";
import type { FranchiseSeason } from "./franchiseTypes";
import type { OffseasonReport } from "./developmentTypes";
function fixture() {
  const run = {
    ...createRun("free", true, 837),
    roster: {
      PG: 65,
      SG: 135,
      SF: 149,
      PF: 68,
      C: 143,
      B1: 121,
      B2: 6,
      B3: 131,
    },
  };
  const teams = createLeague(run).slice(0, 4),
    banks = initialMasteryBanks(teams)!;
  banks[0][65] = 74.9;
  banks[1][teams[1].roster.PG!] = 204.12;
  const history = [
    {
      year: 1,
      seasonSeed: run.seasonSeed,
      replay: {
        teams: structuredClone(teams),
        playoffs: { abilityMastery: banks },
      },
    },
  ] as unknown as FranchiseSeason[];
  return { run, teams, history, final: teamsWithMastery(teams, banks) };
}
it("reconstructs training after trades and rejects modified reports, banks and retroactive initial XP", () => {
  const { run, teams, history, final } = fixture(),
    give = 65,
    receive = teams[1].roster.PG!;
  const trades = [{ year: 1, teamId: 1, giveId: give, receiveId: receive }];
  const swapped = exchangePlayers(final, 0, 1, give, receive);
  const assignments = Object.assign(
    {},
    ...swapped.map((t) => coachTrainingPlans(t)),
  );
  const trained = swapped.map((t) =>
    trainMastery(t, assignments, 1, run.seasonSeed),
  );
  const reports = [
    {
      modelVersion: 1,
      year: 1,
      players: Object.entries(assignments).map(([id, training]) => ({
        pokemonId: Number(id),
        training,
      })),
      tradeStart: 1,
      tradeCount: 0,
      mastery: trained.flatMap((t) => t.changes),
    },
  ] as OffseasonReport[];
  const current = swapped.map((team, i) => ({
    ...team,
    abilityMastery: trained[i].mastery,
  }));
  expect(() =>
    verifyMasteryChronology(
      run,
      current,
      history,
      trades,
      undefined,
      undefined,
      "offseason",
      reports,
    ),
  ).not.toThrow();
  const bad = structuredClone(reports);
  bad[0].mastery![0].gained += 0.01;
  expect(() =>
    verifyMasteryChronology(
      run,
      current,
      history,
      trades,
      undefined,
      undefined,
      "offseason",
      bad,
    ),
  ).toThrow();
  const tampered = structuredClone(current);
  tampered[0].abilityMastery![receive] += 0.01;
  expect(() =>
    verifyMasteryChronology(
      run,
      tampered,
      history,
      trades,
      undefined,
      undefined,
      "offseason",
      reports,
    ),
  ).toThrow();
  const retrospective = structuredClone(history);
  retrospective[0].replay!.teams[0].abilityMastery![65] = 25;
  expect(() =>
    verifyMasteryChronology(
      run,
      current,
      retrospective,
      trades,
      undefined,
      undefined,
      "offseason",
      reports,
    ),
  ).toThrow();
  const next = current.map(retainMastery);
  expect(() =>
    verifyMasteryChronology(
      { ...run, leagueTeams: next },
      next,
      history,
      trades,
      undefined,
      undefined,
      "season",
      reports,
    ),
  ).not.toThrow();
});
it("keeps the season trainer and camp mastery stable when an offseason appointment is recorded before or after camp", () => {
  const state = rookieFixture();
  state.franchise!.teams = assignLeagueCoaches(
    state.franchise!.teams.map((t) =>
      retainMastery({ ...t, abilityVersion: 1 as const }),
    ),
    21,
    new Map([[0, { version: 1, id: "ash" }]]),
  );
  const teams = state.franchise!.teams;
  const before = teams.map((t) =>
    trainMastery(t, coachTrainingPlans(t), 1, state.run.seasonSeed),
  );
  const fired = appointFranchiseCoach(state, null),
    projected = projectedCoaches(teams, fired.franchise!.coachOffice, 1);
  const id = COACHES.find(
    (c) => c.id !== "ash" && !projected.some((t) => t.coach?.id === c.id),
  )!.id;
  const hired = appointFranchiseCoach(fired, id);
  expect(hired.franchise!.teams[0].coach!.id).toBe("ash");
  expect(
    projectedCoaches(teams, hired.franchise!.coachOffice, 1)[0].coach!.id,
  ).toBe(id);
  expect(
    hired.franchise!.teams.map((t) =>
      trainMastery(t, coachTrainingPlans(t), 1, state.run.seasonSeed),
    ),
  ).toEqual(before);
  const camp = {
    ...state,
    franchise: {
      ...state.franchise!,
      teams: teams.map((t, i) => ({ ...t, abilityMastery: before[i].mastery })),
    },
  };
  const after = appointFranchiseCoach(appointFranchiseCoach(camp, null), id);
  expect(after.franchise!.teams.map((t) => t.abilityMastery)).toEqual(
    camp.franchise!.teams.map((t) => t.abilityMastery),
  );
});
