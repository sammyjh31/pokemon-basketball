import { appointLocalCoach, reviewLocalCoaches } from "./coachLocal";
import { projectedCoaches } from "./coachOffice";
import { COACHES } from "./trainerCoaches";
import { localCoachRecords, coachCareers } from "./coachCareers";
import { expect, it } from "vitest";
import { rookieFixture } from "./rookieDraft.testUtils";
import {
  selectTrainerCoach,
  selectLocalCoach,
  localCoachTurn,
} from "./coachSelection";
import { startFranchiseSeason } from "./franchise";
import {
  advanceFranchiseSeasonAsync,
  replaySeasonProgress,
} from "./interactiveSeason";
import * as local from "./localLeague";
import * as career from "./localCareer";
import { simulateLocalSeason } from "./localSeason";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import { ROSTER_SLOTS } from "./types";
it("defers an offseason hire until next year and freezes coached inputs after the first round", async () => {
  const old = rookieFixture(),
    before = JSON.stringify(old.run);
  const hired = selectTrainerCoach(old, "mom");
  expect(JSON.stringify(hired.run)).toBe(before);
  expect(hired.franchise!.teams.every((t) => !t.coach)).toBe(true);
  expect(hired.franchise!.pendingCoach?.id).toBe("mom");
  const next = startFranchiseSeason(hired, 412);
  expect(next.run.coach?.id).toBe("mom");
  expect(next.franchise!.pendingCoach).toBeUndefined();
  expect(new Set(next.run.leagueTeams!.map((t) => t.coach?.id)).size).toBe(30);
  const run = await advanceFranchiseSeasonAsync(next.run, 1);
  expect(replaySeasonProgress(run, 1, {})).toEqual(run.seasonProgress!.result);
  expect(selectTrainerCoach({ ...next, run }, "ash").run).toBe(run);
});
it("preserves local trainers through actual season, playoff, offseason and career reload", () => {
  let d: local.LocalLeague = {
    ...local.createLocalLeague(
      [
        { name: "Sam", teamId: 1 },
        { name: "Lee", teamId: 3 },
      ],
      true,
      42,
      2,
      {
        mode: "full-pool",
        format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
        engineRules: {
          version: 1,
          abilities: true,
          adaptiveCoaching: true,
          familiarity: 0,
        },
      },
    ),
    coachDraftRequired: true,
  };
  for (let turn = localCoachTurn(d); turn; turn = localCoachTurn(d))
    d = selectLocalCoach(d, turn.teamId, turn.teamId === 1 ? "ash" : "mom");
  while (local.currentLocalTurn(d)) {
    d = local.advanceLocalCpu(d);
    const turn = local.currentLocalTurn(d);
    if (!turn) break;
    const mon = local
      .localLeaguePool(d)
      .find((p) => !d.picks.some((x) => x.pokemonId === p.id))!;
    const occupied = d.picks
      .filter((p) => p.teamId === turn.teamId)
      .map((p) => p.slot);
    d = local.pickLocalPlayer(
      d,
      mon.id,
      ROSTER_SLOTS.find((s) => !occupied.includes(s))!,
    );
  }
  const result = simulateLocalSeason(d),
    playoffs = simulatePlayoffs(result.league!, career.localSeasonSeed(d));
  d = { ...d, completed: true, playoffGames: playoffGameCount(playoffs) };
  const next = career.beginLocalOffseason(d, result, playoffs);
  const loaded = local.parseLocalLeague(JSON.stringify(next));
  expect(loaded.career!.teams.map((t) => t.coach)).toEqual(
    result.league!.teams.map((t) => t.coach),
  );
  expect(loaded.career!.history[0].teams.map((t) => t.coach)).toEqual(
    result.league!.teams.map((t) => t.coach),
  );
  const historyBefore = JSON.stringify(loaded.career!.history);
  expect(reviewLocalCoaches(loaded)).toBe(loaded);
  const fired = appointLocalCoach(loaded, 1, null);
  const reloaded = local.parseLocalLeague(JSON.stringify(fired));
  expect(
    projectedCoaches(reloaded.career!.teams, reloaded.career!.coachOffice, 1)[1]
      .coach,
  ).toBeUndefined();
  expect(() => career.startNextLocalSeason(reloaded)).toThrow(/head coach/);
  expect(() => appointLocalCoach(reloaded, 0, null)).toThrow(/human/);
  const assigned = projectedCoaches(
    reloaded.career!.teams,
    reloaded.career!.coachOffice,
    1,
  );
  const available = COACHES.find(
    (c) => c.id !== "ash" && !assigned.some((t) => t.coach?.id === c.id),
  )!;
  const hired = appointLocalCoach(reloaded, 1, available.id);
  // A released trainer can join another human club; their old results stay theirs.
  const moved = appointLocalCoach(hired, 3, "ash");
  const yearTwo = local.parseLocalLeague(
    JSON.stringify(career.startNextLocalSeason(moved)),
  );
  expect(yearTwo.career!.teams[1].coach?.id).toBe(available.id);
  expect(yearTwo.career!.teams[3].coach?.id).toBe("ash");
  expect(JSON.stringify(yearTwo.career!.history)).toBe(historyBefore);
  expect(() => appointLocalCoach(yearTwo, 1, null)).toThrow(/offseason/);
  const records = localCoachRecords(yearTwo.career, yearTwo.career!.teams);
  expect(
    coachCareers(records).find((c) => c.coach.id === "ash")!.seasons[0].teamId,
  ).toBe(1);
  const restored = career.replayLocalHistory(yearTwo, 1);
  expect(restored.playoffs).toEqual(playoffs);
  const resultTwo = simulateLocalSeason(yearTwo),
    playoffsTwo = simulatePlayoffs(
      resultTwo.league!,
      career.localSeasonSeed(yearTwo),
    );
  const two = career.beginLocalOffseason(
    {
      ...yearTwo,
      completed: true,
      playoffGames: playoffGameCount(playoffsTwo),
    },
    resultTwo,
    playoffsTwo,
  );
  const loadedTwo = local.parseLocalLeague(JSON.stringify(two));
  const ash = coachCareers(
    localCoachRecords(loadedTwo.career, loadedTwo.career!.teams),
  ).find((c) => c.coach.id === "ash")!;
  expect(ash.seasons.map((s) => s.teamId)).toEqual([1, 3]);
  expect(ash.wins + ash.losses).toBe(28);
  expect(
    coachCareers(
      localCoachRecords(loadedTwo.career, loadedTwo.career!.teams),
    ).reduce((n, c) => n + c.championships, 0),
  ).toBe(2);
  const corrupted = structuredClone(yearTwo);
  corrupted.career!.teams[1].coach = { version: 1, id: "mom" };
  expect(() => local.parseLocalLeague(JSON.stringify(corrupted))).toThrow();
  const old = structuredClone(loaded);
  delete old.career!.history[0].coachRecords;
  delete old.career!.coachOffice;
  const oldLoaded = local.parseLocalLeague(JSON.stringify(old));
  const oldRecords = localCoachRecords(
    oldLoaded.career,
    oldLoaded.career!.teams,
  );
  expect(oldRecords.every((r) => !r.postseasonKnown)).toBe(true);
  expect(oldRecords.filter((r) => r.champion)).toHaveLength(1);
}, 60000);
