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
  d = selectLocalCoach(d, localCoachTurn(d)!.teamId, "ash");
  d = selectLocalCoach(d, localCoachTurn(d)!.teamId, "mom");
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
}, 60000);
