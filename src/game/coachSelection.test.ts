import { expect, it } from "vitest";
import { initialState, gameReducer } from "./state";
import {
  selectTrainerCoach,
  selectLocalCoach,
  localCoachTurn,
} from "./coachSelection";
import { COACHES, coachOffers } from "./trainerCoaches";
import {
  createLocalLeague,
  advanceLocalCpu,
  parseLocalLeague,
} from "./localLeague";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { validateLeagueTeams } from "./franchiseValidation";
import { loadGame, saveGame } from "./persistence";
import { archivedSeasonRun } from "./archive";
import type { FranchiseSeason } from "./franchiseTypes";
const full = () => ({
  ...createRun("free", true, 22),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
it("enforces the three offers only in the challenge and locks the trainer once chosen", () => {
  const s = initialState(55),
    offered = coachOffers(s.run.seasonSeed);
  const outside = COACHES.find((c) => !offered.some((o) => o.id === c.id))!;
  expect(selectTrainerCoach(s, outside.id)).toBe(s);
  const selected = selectTrainerCoach(s, offered[0].id);
  expect(selected.run.coach?.id).toBe(offered[0].id);
  expect(selectTrainerCoach(selected, offered[1].id)).toBe(selected);
  expect(
    selectTrainerCoach({ ...s, run: { ...s.run, mode: "free" } }, outside.id)
      .run.coach?.id,
  ).toBe(outside.id);
  const started = {
    ...s,
    run: {
      ...s.run,
      seasonProgress: {
        modelVersion: 1 as const,
        completedRounds: 1,
        playedGames: {},
      },
    },
  };
  expect(selectTrainerCoach(started, offered[0].id)).toBe(started);
});
it("keeps human choices available until every local manager has selected then uniquely fills CPU jobs", () => {
  let d = {
    ...createLocalLeague(
      [
        { name: "Sam", teamId: 0 },
        { name: "Lee", teamId: 1 },
      ],
      true,
      22,
    ),
    coachDraftRequired: true as const,
  };
  expect(advanceLocalCpu(d).picks).toHaveLength(0);
  const first = localCoachTurn(d)!;
  d = selectLocalCoach(d, first.teamId, "mom") as typeof d;
  expect(d.coaching.filter((c) => c.coach)).toHaveLength(1);
  d = parseLocalLeague(JSON.stringify(d)) as typeof d;
  const next = localCoachTurn(d)!;
  expect(next.teamId).not.toBe(first.teamId);
  expect(() => selectLocalCoach(d, next.teamId, "mom")).toThrow();
  d = selectLocalCoach(d, next.teamId, "ash") as typeof d;
  expect(localCoachTurn(d)).toBeUndefined();
  expect(new Set(d.coaching.map((c) => c.coach?.id)).size).toBe(30);
  expect(parseLocalLeague(JSON.stringify(d))).toEqual(d);
});
it("persists assignments in solo saves, league inputs and historical replay, rejecting duplicate identities", () => {
  const state = selectTrainerCoach({ ...initialState(22), run: full() }, "mom");
  let value = "";
  const storage = {
    getItem: () => value || null,
    setItem: (_k: string, v: string) => {
      value = v;
    },
  };
  saveGame(storage, state);
  expect(loadGame(storage, 22).state.run.coach?.id).toBe("mom");
  const teams = createLeague(state.run);
  expect(validateLeagueTeams(teams, true)).toEqual(teams);
  expect(
    archivedSeasonRun({
      seasonSeed: 22,
      replay: { teams, seasonModel: 4 },
    } as FranchiseSeason).coach?.id,
  ).toBe("mom");
  const bad = structuredClone(teams);
  bad[1].coach = bad[0].coach;
  expect(() => validateLeagueTeams(bad, true)).toThrow();
  value = JSON.stringify({
    ...state,
    run: { ...state.run, coach: { version: 2, id: "mom" } },
  });
  const before = value;
  expect(loadGame(storage, 22).notice).not.toBeNull();
  expect(value).toBe(before);
});
it("blocks simulation while an interactive coach draft is pending", () => {
  const s = {
    ...initialState(22),
    run: { ...full(), coachDraftRequired: true as const },
  };
  expect(gameReducer(s, { type: "SIMULATE" })).toBe(s);
});
