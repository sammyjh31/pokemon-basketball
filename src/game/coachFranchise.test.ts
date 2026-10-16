import { expect, it } from "vitest";
import { rookieFixture } from "./rookieDraft.testUtils";
import { assignLeagueCoaches, COACHES } from "./trainerCoaches";
import {
  appointFranchiseCoach,
  reviewFranchiseCoaches,
} from "./coachFranchise";
import { projectedCoaches, verifyCoachChronology } from "./coachOffice";
import { startFranchiseSeason } from "./franchise";
it("carries a new coach into next year without rewriting the old season; vacancies block starting", () => {
  let state = rookieFixture();
  const teams = assignLeagueCoaches(
    state.franchise!.teams,
    21,
    new Map([[0, { version: 1, id: "ash" }]]),
  );
  state = {
    ...state,
    run: { ...state.run, coach: teams[0].coach, leagueTeams: teams },
    franchise: { ...state.franchise!, teams },
  };
  const before = JSON.stringify(state.run);
  const reviewed = reviewFranchiseCoaches(state);
  const fired = appointFranchiseCoach(reviewed, null);
  expect(startFranchiseSeason(fired, 512)).toBe(fired);
  expect(appointFranchiseCoach(fired, teams[28].coach!.id)).toBe(fired);
  const projected = projectedCoaches(teams, fired.franchise!.coachOffice, 1);
  const id = COACHES.find(
    (c) => c.id !== "ash" && !projected.some((t) => t.coach?.id === c.id),
  )!.id;
  const hired = appointFranchiseCoach(fired, id);
  expect(JSON.stringify(hired.run)).toBe(before);
  const next = startFranchiseSeason(hired, 512);
  expect(next.run.coach?.id).toBe(id);
  expect(next.franchise!.teams[0].coach?.id).toBe(id);
  expect(next.franchise!.history).toEqual(state.franchise!.history);
  expect(appointFranchiseCoach(next, null)).toBe(next);
  expect(() =>
    verifyCoachChronology(hired.franchise!.coachOffice, [
      { year: 1, teams },
      { year: 2, teams: next.franchise!.teams },
    ]),
  ).not.toThrow();
  const bad = structuredClone(next.franchise!.teams);
  bad[0].coach = { version: 1, id: "ash" };
  expect(() =>
    verifyCoachChronology(hired.franchise!.coachOffice, [
      { year: 1, teams },
      { year: 2, teams: bad },
    ]),
  ).toThrow();
});

import { initialState, gameReducer } from "./state";
import { simulateSeason } from "./season";
import { simulatePlayoffs } from "./playoffs";
import { archiveFranchiseSeason } from "./franchise";
import { selectTrainerCoach } from "./coachSelection";
import { prepareGameLoad } from "./persistence";
import { franchiseCoachRecords, coachCareers } from "./coachCareers";
it("round-trips a completed coached franchise and next-season appointments through the real save loader", async () => {
  const roster = rookieFixture().run;
  const drafted = selectTrainerCoach(
    { ...initialState(82), run: roster },
    "ash",
  );
  const result = simulateSeason(drafted.run);
  const playoffs = simulatePlayoffs(result.league!, drafted.run.seasonSeed);
  const season = gameReducer(drafted, {
    type: "APPLY_SEASON",
    source: drafted.run,
    result,
  });
  const completed = { ...season, run: { ...season.run, playoffs } };
  const archived = reviewFranchiseCoaches(archiveFranchiseSeason(completed));
  expect(archived.franchise?.history[0].replay).toBeDefined();
  const fired = appointFranchiseCoach(archived, null);
  const load = (state: typeof archived) =>
    prepareGameLoad(
      { getItem: () => JSON.stringify(state), setItem: () => {} },
      999,
    );
  const prepared = load(fired);
  expect(prepared.notice).toBeNull();
  expect(prepared.state.franchise?.coachOffice).toEqual(
    fired.franchise!.coachOffice,
  );
  const restored = await prepared.restore!(
    () => {},
    new AbortController().signal,
  );
  expect(restored.notice).toBeNull();
  expect(startFranchiseSeason(restored.state, 512)).toBe(restored.state);
  const available = COACHES.find(
    (c) =>
      c.id !== "ash" &&
      !projectedCoaches(
        fired.franchise!.teams,
        fired.franchise!.coachOffice,
        1,
      ).some((t) => t.coach?.id === c.id),
  )!;
  const hired = appointFranchiseCoach(restored.state, available.id);
  const next = startFranchiseSeason(hired, 512);
  const loaded = load(next);
  expect(loaded.notice).toBeNull();
  expect(loaded.state.run.coach?.id).toBe(available.id);
  expect(loaded.state.franchise?.coachOffice).toEqual(
    hired.franchise!.coachOffice,
  );
  const records = franchiseCoachRecords(next.franchise!, next.run);
  const ash = coachCareers(records).find((c) => c.coach.id === "ash")!;
  expect(ash.wins + ash.losses).toBe(82);
  expect(ash.seasons[0].teamId).toBe(0);
  expect(coachCareers(records).reduce((n, c) => n + c.championships, 0)).toBe(
    1,
  );
  expect(next.franchise!.history[0].replay!.teams[0].coach?.id).toBe("ash");
}, 120000);
