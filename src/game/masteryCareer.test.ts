import { expect, it } from "vitest";
import * as local from "./localLeague";
import * as career from "./localCareer";
import { ROSTER_SLOTS } from "./types";
import { simulateLocalSeason } from "./localSeason";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import { rookieFixture } from "./rookieDraft.testUtils";
import { retainMastery } from "./abilityMastery";
import {
  beginRookieDraft,
  recommendedRookiePick,
  selectRookie,
} from "./rookieDraft";
import { freeAgentMarket, signFreeAgent } from "./freeAgency";
const options = {
  mode: "generational",
  format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
  engineRules: {
    version: 1,
    abilities: true,
    adaptiveCoaching: true,
    familiarity: 0,
  },
} as const;
function drafted() {
  let draft = local.createLocalLeague(
    [
      { name: "Sam", teamId: 1 },
      { name: "Alex", teamId: 3 },
    ],
    true,
    42,
    2,
    options,
  );
  while (local.currentLocalTurn(draft)) {
    draft = local.advanceLocalCpu(draft);
    const turn = local.currentLocalTurn(draft);
    if (!turn) break;
    const taken = new Set(draft.picks.map((p) => p.pokemonId)),
      mon = local.localLeaguePool(draft).find((p) => !taken.has(p.id))!;
    const occupied = draft.picks
      .filter((p) => p.teamId === turn.teamId)
      .map((p) => p.slot);
    draft = local.pickLocalPlayer(
      draft,
      mon.id,
      ROSTER_SLOTS.find((s) => !occupied.includes(s))!,
    );
  }
  return draft;
}
it("restores two local years with recorded mastery training, game facts, rookies and tamper rejection", () => {
  let draft = drafted();
  const original = structuredClone(local.localLeagueTeams(draft));
  const season = simulateLocalSeason(draft),
    playoffs = simulatePlayoffs(season.league!, career.localSeasonSeed(draft));
  draft = {
    ...draft,
    completed: true,
    playoffGames: playoffGameCount(playoffs),
  };
  draft = career.beginLocalOffseason(draft, season, playoffs);
  expect(draft.career!.history[0].mastery).toHaveLength(32);
  expect(draft.career!.history[0].newsGames).toHaveLength(31);
  expect(draft.career!.history[0].newsPlayers).toEqual(
    season
      .league!.players.filter((p) => p.highPoints >= 40)
      .map(({ pokemonId, teamId, highPoints, gamesPlayed }) => ({
        pokemonId,
        teamId,
        highPoints,
        gamesPlayed,
      })),
  );
  expect(
    local
      .localLeagueTeams(draft)
      .some((t) => Object.values(t.abilityMastery!).some((xp) => xp > 12)),
  ).toBe(true);
  for (
    let turn = career.currentLocalRookieTurn(draft);
    turn;
    turn = career.currentLocalRookieTurn(draft)
  ) {
    draft = career.pickLocalRookie(
      draft,
      career.localRookiePool(draft)[0].id,
      local.localLeagueTeams(draft)[turn.teamId].roster.PG!,
    );
  }
  for (const pick of draft.career!.history[0].rookiePicks)
    if (
      Object.values(draft.career!.teams[pick.teamId].roster).includes(
        pick.pokemonId,
      )
    )
      expect(
        draft.career!.teams[pick.teamId].abilityMastery![pick.pokemonId],
      ).toBe(0);
  const before = structuredClone(draft.career!.teams);
  draft = career.startNextLocalSeason(draft);
  expect(draft.career!.year).toBe(2);
  expect(draft.career!.teams.map((t) => t.abilityMastery)).toEqual(
    before.map((t) => t.abilityMastery),
  );
  const saved = JSON.parse(JSON.stringify(draft));
  const restored = local.parseLocalLeague(JSON.stringify(saved))!;
  expect(restored.career!.teams.map((t) => t.abilityMastery)).toEqual(
    draft.career!.teams.map((t) => t.abilityMastery),
  );
  expect(restored.career!.history[0].mastery).toEqual(
    draft.career!.history[0].mastery,
  );
  const bad = structuredClone(saved);
  bad.career.history[0].mastery[0].after += 1;
  expect(() => local.parseLocalLeague(JSON.stringify(bad))).toThrow();
  const changed = structuredClone(saved);
  changed.career.teams[0].abilityMastery[
    Object.values(changed.career.teams[0].roster)[0] as number
  ] += 1;
  expect(() => local.parseLocalLeague(JSON.stringify(changed))).toThrow();
  expect(season.league!.teams).toEqual(original);
}, 60000);

it("returns released players to free agency with recorded mastery while new rookies start at zero", () => {
  let state = rookieFixture();
  state.franchise!.teams = state.franchise!.teams.map((team) =>
    retainMastery({ ...team, abilityVersion: 1 as const }),
  );
  const released = state.franchise!.teams[0].roster.PG!;
  state.franchise!.teams[0].abilityMastery![released] = 88.25;
  const report = state.franchise!.offseasons![0];
  report.mastery = [
    {
      teamId: 0,
      pokemonId: released,
      before: 75,
      after: 88.25,
      gained: 13.25,
      levelBefore: "Practiced",
      levelAfter: "Practiced",
      focus: "balanced",
      breakthrough: false,
      reasons: ["Recorded training."],
    },
  ];
  state = beginRookieDraft(state);
  state = selectRookie(state, 252, released);
  while (!state.franchise!.rookieDrafts!.at(-1)!.complete) {
    const pick = recommendedRookiePick(state.franchise!, 0, false)!;
    state = selectRookie(state, pick.pokemonId, pick.releasedId);
  }
  expect(state.franchise!.teams[0].abilityMastery![252]).toBe(0);
  expect(
    freeAgentMarket(state.franchise!, false).find(
      (p) => p.pokemonId === released,
    )?.abilityMastery,
  ).toBe(88.25);
  const next = signFreeAgent(
    state,
    released,
    state.franchise!.teams[0].roster.B3!,
  );
  expect(next).not.toBe(state);
  expect(next.franchise!.teams[0].abilityMastery![released]).toBe(88.25);
});

it("leaves legacy active seasons unchanged and adopts zero mastery at the next local season", () => {
  let draft = drafted();
  delete draft.movesetVersion;
  delete draft.abilityMasteryVersion;
  expect(
    local
      .localLeagueTeams(draft)
      .every((t) => t.abilityMasteryVersion === undefined),
  ).toBe(true);
  const season = simulateLocalSeason(draft),
    playoffs = simulatePlayoffs(season.league!, career.localSeasonSeed(draft));
  expect(season.league!.abilityMastery).toBeUndefined();
  draft = career.beginLocalOffseason(
    { ...draft, completed: true, playoffGames: playoffGameCount(playoffs) },
    season,
    playoffs,
  );
  expect(draft.career!.history[0].mastery).toBeUndefined();
  for (
    let turn = career.currentLocalRookieTurn(draft);
    turn;
    turn = career.currentLocalRookieTurn(draft)
  )
    draft = career.pickLocalRookie(
      draft,
      career.localRookiePool(draft)[0].id,
      local.localLeagueTeams(draft)[turn.teamId].roster.PG!,
    );
  draft = career.startNextLocalSeason(draft);
  expect(
    draft.career!.teams.every(
      (t) =>
        t.abilityMasteryVersion === 1 &&
        Object.values(t.abilityMastery!).every((xp) => xp === 0),
    ),
  ).toBe(true);
  expect(
    local
      .parseLocalLeague(JSON.stringify(draft))
      .career!.teams.map((t) => t.abilityMastery),
  ).toEqual(draft.career!.teams.map((t) => t.abilityMastery));
}, 60000);
