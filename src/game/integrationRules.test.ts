import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import { coachRotationMinutes } from "./coachPolicy";
import { DEVELOPMENT_SKILLS } from "./developmentTypes";
import { speciesAbility } from "./abilities";
import { captureCoachRecords, validateCoachRecords } from "./coachCareers";
import { ROSTER_SLOTS, type Standing } from "./types";
import type { Playoffs } from "./playoffTypes";
import * as local from "./localLeague";
import * as career from "./localCareer";
import { localCoachTurn, selectLocalCoach } from "./coachSelection";
import { simulateLocalSeason } from "./localSeason";
import { playoffGameCount, simulatePlayoffs } from "./playoffs";

const run = () => ({
  ...createRun("free", true, 22),
  coach: { version: 1 as const, id: "misty" },
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 248, B1: 121, B2: 6, B3: 131 },
});
it("does not let disabled weather-setting abilities override the arena", () => {
  expect(speciesAbility(248).id).toBe("sand-stream");
  const teams = createLeague(run());
  const disabled = teams.map((team) => ({
    ...team,
    engineRules: {
      version: 1 as const,
      abilities: false,
      adaptiveCoaching: true,
      familiarity: 0,
    },
  }));
  const off = simulateMatch(disabled[0], disabled[1], 17);
  expect(off.gameFlow!.arena.condition).toBe("neutral");
  expect(off.gameFlow!.setterPossessions).toBe(0);
  const on = simulateMatch(teams[0], teams[1], 17);
  expect(on.gameFlow!.setterPossessions).toBeGreaterThan(0);
});

it("validates coach records against replayed playoff seeds when head-to-head beats point difference", () => {
  const teams = [
    { id: 0, coach: { version: 1 as const, id: "ash" } },
    { id: 1, coach: { version: 1 as const, id: "mom" } },
  ];
  const standings = [
    { teamId: 0, wins: 50, losses: 32, pointsFor: 9000, pointsAgainst: 8000 },
    { teamId: 1, wins: 50, losses: 32, pointsFor: 8000, pointsAgainst: 8000 },
  ] as Standing[];
  const playoffs = {
    seeds: [
      { teamId: 1, seed: 1 },
      { teamId: 0, seed: 2 },
    ],
    series: [
      {
        round: 3,
        higherSeedId: 1,
        lowerSeedId: 0,
        higherSeedWins: 2,
        lowerSeedWins: 4,
        winnerId: 0,
      },
    ],
    championId: 0,
  } as Playoffs;
  const rows = captureCoachRecords(teams, standings, playoffs, 1);
  const parsed = validateCoachRecords(
    rows,
    teams,
    standings,
    1,
    0,
    2,
    7,
    6,
    playoffs.seeds,
  );
  expect(parsed.map((r) => [r.teamId, r.playoffSeed])).toEqual([
    [0, 2],
    [1, 1],
  ]);
  const corrupt = structuredClone(rows);
  corrupt[0].playoffSeed = 1;
  expect(() =>
    validateCoachRecords(
      corrupt,
      teams,
      standings,
      1,
      0,
      2,
      7,
      6,
      playoffs.seeds,
    ),
  ).toThrow();
});

it("keeps the bench on court after a timeout in a decided fourth quarter", () => {
  const teams = createLeague(run())
    .slice(0, 2)
    .map((team, i) => ({
      ...team,
      development: Object.fromEntries(
        ROSTER_SLOTS.map((slot) => [
          team.roster[slot]!,
          Object.fromEntries(
            DEVELOPMENT_SKILLS.map((skill) => [skill, i === 0 ? 25 : -25]),
          ),
        ]),
      ),
    }));
  const benches = teams.map((team) => {
    const minutes = coachRotationMinutes(team);
    return [...ROSTER_SLOTS]
      .sort((a, b) => minutes[a] - minutes[b])
      .slice(0, 3)
      .map((slot) => `${team.id}:${team.roster[slot]}`);
  });
  let checked = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const match = simulateMatch(teams[0], teams[1], seed);
    for (const timeout of match.gameFlow!.timeouts) {
      const minute = Math.floor(timeout.elapsedSeconds / 60),
        lead = Math.abs(timeout.margin);
      if (
        timeout.period !== 4 ||
        !(minute >= 42 ? lead >= 16 : minute >= 36 && lead >= 22)
      )
        continue;
      const sequence = match.insights!.court!.find(
        (s) => s.elapsedSeconds >= timeout.elapsedSeconds,
      );
      if (!sequence) continue;
      for (let side = 0; side < 2; side++) {
        const box = side === 0 ? match.homeBox : match.awayBox;
        if (box.some((p) => benches[side].includes(p.playerId) && p.fouls >= 6))
          continue;
        const floor = sequence.positions.map((p) => p.playerId);
        expect(
          benches[side].filter((id) => floor.includes(id)).length,
          `seed ${seed}, timeout ${timeout.elapsedSeconds}, team ${side}`,
        ).toBeGreaterThanOrEqual(2);
        checked++;
      }
    }
  }
  expect(checked).toBeGreaterThan(0);
}, 120000);

it("reloads a coached local career with court-v3 playoff tiebreaks", () => {
  let draft: local.LocalLeague = {
    ...local.createLocalLeague(
      [
        { name: "Sam", teamId: 0 },
        { name: "Lee", teamId: 1 },
      ],
      true,
      1,
      2,
      {
        mode: "full-pool",
        format: {
          teamCount: 8,
          gamesPerTeam: 14,
          playoffTeams: 4,
          bestOf: 1,
        },
        engineRules: {
          version: 1,
          abilities: true,
          adaptiveCoaching: true,
          familiarity: 0,
        },
      },
    ),
    // Pin the recorded v3 season behind this head-to-head regression.
    movesetVersion: undefined,
    courtVersion: 3,
    coachDraftRequired: true,
  };
  delete draft.gameFlowVersion;
  for (let turn = localCoachTurn(draft); turn; turn = localCoachTurn(draft))
    draft = selectLocalCoach(
      draft,
      turn.teamId,
      turn.teamId === 0 ? "ash" : "mom",
    );
  while (local.currentLocalTurn(draft)) {
    draft = local.advanceLocalCpu(draft);
    const turn = local.currentLocalTurn(draft);
    if (!turn) break;
    const mon = local
      .localLeaguePool(draft)
      .find((p) => !draft.picks.some((pick) => pick.pokemonId === p.id))!;
    const slot = ROSTER_SLOTS.find(
      (slot) =>
        !draft.picks.some(
          (pick) => pick.teamId === turn.teamId && pick.slot === slot,
        ),
    )!;
    draft = local.pickLocalPlayer(draft, mon.id, slot);
  }
  const result = simulateLocalSeason(draft),
    playoffs = simulatePlayoffs(result.league!, career.localSeasonSeed(draft));
  const oldSeeds = [...result.league!.standings]
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
        a.teamId - b.teamId,
    )
    .slice(0, 4)
    .map((s) => s.teamId);
  expect(oldSeeds).toEqual([6, 7, 2, 5]);
  expect(playoffs.seeds.map((s) => s.teamId)).toEqual([6, 2, 7, 5]);
  const archived = career.beginLocalOffseason(
    { ...draft, completed: true, playoffGames: playoffGameCount(playoffs) },
    result,
    playoffs,
  );
  const loaded = local.parseLocalLeague(JSON.stringify(archived));
  expect(loaded.career!.history[0].championId).toBe(playoffs.championId);
  expect(loaded.career!.history[0].coachRecords).toEqual(
    archived.career!.history[0].coachRecords,
  );
}, 120000);
