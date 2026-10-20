import { retainMastery } from "./abilityMastery";
import { retainMorale } from "./playerMorale";
import { retainChemistry } from "./teammateChemistry";
import { beforeAll, describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { COURT_VERSION } from "./courtTypes";
import { createRun, placePokemon } from "./draft";
import {
  applyTrade,
  careerPlayers,
  enterOffseason,
  evaluateTrade,
  startFranchiseSeason,
} from "./franchise";
import { CAREER_KEYS, type Franchise } from "./franchiseTypes";
import { simulatePlayoffs } from "./playoffs";
import { positionRating, teamRatings } from "./ratings";
import { simulateSeason } from "./season";
import { initialState } from "./state";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type GameState,
  type LeaguePlayer,
} from "./types";

let finished: GameState;
beforeAll(() => {
  let run = createRun("free", true, 82);
  // Preserve the explicitly historical model-1/2 helper contract.
  delete run.movesetVersion;
  delete run.abilityMasteryVersion;
  delete run.chemistryGrowthVersion;
  delete run.moraleVersion;
  delete run.personalityVersion;
  [129, 150, 149, 68, 143, 9, 94, 59].forEach((id, index) => {
    run = placePokemon(run, id, ROSTER_SLOTS[index]);
  });
  const result = simulateSeason(run);
  const playoffs = simulatePlayoffs(result.league!, run.seasonSeed);
  finished = {
    ...initialState(82),
    run: { ...run, result, playoffs },
    records: {
      spin: { runs: 3, bestWins: 50, perfectSeasons: 0 },
      free: { runs: 4, bestWins: 60, perfectSeasons: 0 },
    },
  };
}, 600000);

const ability = (id: number) =>
  Math.max(
    ...POSITIONS.map((position) =>
      positionRating(POKEMON_BY_ID.get(id)!, position),
    ),
  );
function partnerPlayer(franchise: Franchise, strongest: boolean) {
  return franchise.teams
    .slice(1)
    .flatMap((team) =>
      ROSTER_SLOTS.map((slot) => ({ teamId: team.id, id: team.roster[slot]! })),
    )
    .sort((a, b) => (strongest ? -1 : 1) * (ability(a.id) - ability(b.id)))[0];
}
function totalsMatch(
  actual: Pick<LeaguePlayer, (typeof CAREER_KEYS)[number]>,
  source: LeaguePlayer,
) {
  for (const key of CAREER_KEYS) expect(actual[key], key).toBe(source[key]);
}

describe("franchise lifecycle", () => {
  it("archives the completed first season once, including all 240 species and immutable honors", () => {
    const original = structuredClone(finished);
    const next = enterOffseason(finished);
    const franchise = next.franchise!;
    expect(franchise).toMatchObject({
      modelVersion: 1,
      year: 1,
      phase: "offseason",
      trades: [],
    });
    expect(franchise.careers).toHaveLength(240);
    expect(franchise.history).toHaveLength(1);
    expect(next.run).toBe(finished.run);
    expect(next.records).toBe(finished.records);
    const history = franchise.history[0];
    const league = finished.run.result!.league!;
    const finals = finished.run.playoffs!.series.find(
      (series) => series.round === 3,
    )!;
    expect(history.standings).toEqual(league.standings);
    expect(history.rosters).toEqual(
      league.teams.map((team) => ROSTER_SLOTS.map((slot) => team.roster[slot])),
    );
    expect(history.awards).toHaveLength(6);
    expect(
      history.awards.map((award) => [award.id, award.pokemonId, award.teamId]),
    ).toEqual(
      league.awards.map((award) => [award.id, award.pokemonId, award.teamId]),
    );
    expect(history.allLeague).toHaveLength(5);
    expect(history.allDefense).toHaveLength(5);
    for (const honor of [...history.allLeague, ...history.allDefense])
      expect(history.rosters[honor.teamId]).toContain(honor.pokemonId);
    expect(history.championId).toBe(finished.run.playoffs!.championId);
    expect(history.runnerUpId).toBe(
      finals.higherSeedId === history.championId
        ? finals.lowerSeedId
        : finals.higherSeedId,
    );
    expect(history.runnerUpWins).toBe(
      finals.higherSeedId === history.championId
        ? finals.lowerSeedWins
        : finals.higherSeedWins,
    );
    expect(history.finalsMvp).toEqual(finished.run.playoffs!.finalsMvp);
    expect(enterOffseason(next)).toBe(next);
    expect(careerPlayers(franchise, next.run)).toEqual(franchise.careers);
    expect(finished).toEqual(original);
    franchise.teams[0].roster.PG = 1;
    history.standings[0].wins = 0;
    history.finalsMvp.value = "Changed copy";
    expect(finished).toEqual(original);
  });

  it("keeps regular-season and postseason games, starts, highs and counting totals separate", () => {
    const franchise = enterOffseason(finished).franchise!;
    for (const player of finished.run.result!.league!.players) {
      const career = franchise.careers.find(
        (entry) => entry.pokemonId === player.pokemonId,
      )!;
      expect(career.seasons).toBe(1);
      expect(career.teamIds).toEqual([player.teamId]);
      totalsMatch(career.regular, player);
      const postseason = finished.run.playoffs!.players.find(
        (entry) => entry.pokemonId === player.pokemonId,
      );
      if (postseason) totalsMatch(career.playoffs, postseason);
      else for (const key of CAREER_KEYS) expect(career.playoffs[key]).toBe(0);
    }
  });

  it("rejects missing, incomplete, unsupported and inconsistent championship state", () => {
    const cases: GameState[] = [
      initialState(42),
      { ...finished, run: { ...finished.run, playoffs: undefined } },
      {
        ...finished,
        run: {
          ...finished.run,
          playoffs: { ...finished.run.playoffs!, championId: null },
        },
      },
      {
        ...finished,
        run: {
          ...finished.run,
          playoffs: { ...finished.run.playoffs!, finalsMvp: null },
        },
      },
      {
        ...finished,
        run: {
          ...finished.run,
          result: { ...finished.run.result!, modelVersion: 2 },
        },
      },
      {
        ...finished,
        run: {
          ...finished.run,
          result: { ...finished.run.result!, modelVersion: 4 },
        },
      },
      {
        ...finished,
        run: {
          ...finished.run,
          playoffs: {
            ...finished.run.playoffs!,
            series: finished.run.playoffs!.series.map((series) =>
              series.round === 3 ? { ...series, winnerId: null } : series,
            ),
          },
        },
      },
    ];
    for (const state of cases) {
      expect(enterOffseason(state)).toBe(state);
      expect(startFranchiseSeason(state, 99)).toBe(state);
      expect(applyTrade(state, 1, 129, 1)).toBe(state);
    }
    const offseason = enterOffseason(finished);
    const duplicate = {
      ...offseason,
      franchise: { ...offseason.franchise!, phase: "season" as const },
    };
    expect(enterOffseason(duplicate)).toBe(duplicate);
    expect(startFranchiseSeason(duplicate, 99)).toBe(duplicate);
  });

  it("starts a fresh seeded year with the carried roster and coaching without changing challenge records", () => {
    const offseason = enterOffseason(finished);
    offseason.franchise!.teams[0].tactic = "defense";
    offseason.franchise!.teams[0].rotation = "bench";
    offseason.franchise!.teams[0].defense = "zone";
    offseason.franchise!.teams[0].ratings = teamRatings(
      offseason.franchise!.teams[0].roster,
      "defense",
      "bench",
    );
    const before = structuredClone(offseason);
    // Season boundaries opt every club in, while the completed season stays frozen.
    const historicalVersion = offseason.run.courtVersion;
    const next = startFranchiseSeason(offseason, 903);
    expect(next.run.courtVersion).toBe(COURT_VERSION);
    expect(
      next.franchise!.teams.every((t) => t.courtVersion === COURT_VERSION),
    ).toBe(true);
    expect(offseason.run.courtVersion).toBe(historicalVersion);
    expect(next.franchise).toMatchObject({ year: 2, phase: "season" });
    expect(next.run).toMatchObject({
      mode: "free",
      includeLegends: true,
      result: null,
      tactic: "defense",
      rotation: "bench",
      defense: "zone",
      offerIds: [],
    });
    expect(next.run.id).toBe(createRun("free", true, 903).id);
    expect(next.run.seasonSeed).toBe(createRun("free", true, 903).seasonSeed);
    expect(next.run.playoffs).toBeUndefined();
    expect(next.run.roster).toEqual(offseason.franchise!.teams[0].roster);
    expect(next.run.leagueTeams).toEqual(
      offseason
        .franchise!.teams.map(retainChemistry)
        .map(retainMorale)
        .map(retainMastery)
        .map((team) => ({
          ...team,
          personalityVersion: 1 as const,
          movesetVersion: 4 as const,
        })),
    );
    expect(next.run.leagueTeams).not.toBe(offseason.franchise!.teams);
    expect(next.run.leagueTeams![0].roster).not.toBe(
      next.franchise!.teams[0].roster,
    );
    expect(next.records).toBe(offseason.records);
    expect(next.franchise!.history).toEqual(offseason.franchise!.history);
    expect(next.franchise!.careers).toEqual(offseason.franchise!.careers);
    expect(careerPlayers(next.franchise!, next.run)).toEqual(
      offseason.franchise!.careers,
    );
    expect(startFranchiseSeason(next, 904)).toBe(next);
    expect(enterOffseason(next)).toBe(next);
    expect(offseason).toEqual(before);
  });
});

describe("offseason trades", () => {
  it("rejects a clear ability downgrade and invalid membership, with a usable explanation", () => {
    const offseason = enterOffseason(finished);
    const franchise = offseason.franchise!;
    const star = partnerPlayer(franchise, true);
    const evaluation = evaluateTrade(franchise, star.teamId, 129, star.id);
    expect(evaluation.accepted).toBe(false);
    expect(evaluation.reason.length).toBeGreaterThan(15);
    expect(evaluation.outgoingValue).toBeLessThan(
      evaluation.incomingValue - 10,
    );
    expect(evaluation.incomingValue).toBeLessThanOrEqual(100);
    expect(applyTrade(offseason, star.teamId, 129, star.id)).toBe(offseason);
    for (const [teamId, giveId, receiveId] of [
      [0, 129, 150],
      [99, 129, star.id],
      [star.teamId, star.id, 129],
      [star.teamId, 150, 150],
    ]) {
      expect(evaluateTrade(franchise, teamId, giveId, receiveId).accepted).toBe(
        false,
      );
      expect(applyTrade(offseason, teamId, giveId, receiveId)).toBe(offseason);
    }
    const active = startFranchiseSeason(offseason, 400);
    expect(
      evaluateTrade(active.franchise!, star.teamId, 150, star.id).accepted,
    ).toBe(false);
    expect(applyTrade(active, star.teamId, 150, star.id)).toBe(active);
  });

  it("exchanges existing slots, updates both ratings and logs the year while conserving 240 unique species", () => {
    const offseason = enterOffseason(finished);
    const franchise = offseason.franchise!;
    const target = partnerPlayer(franchise, false);
    const partner = franchise.teams[target.teamId];
    const partnerSlot = ROSTER_SLOTS.find(
      (slot) => partner.roster[slot] === target.id,
    )!;
    const before = structuredClone(offseason);
    const evaluation = evaluateTrade(franchise, target.teamId, 150, target.id);
    expect(evaluation.accepted).toBe(true);
    expect(evaluation.partnerAfter).toBeGreaterThan(evaluation.partnerBefore);
    const next = applyTrade(offseason, target.teamId, 150, target.id);
    expect(next.franchise!.teams[0].roster.SG).toBe(target.id);
    expect(next.franchise!.teams[target.teamId].roster[partnerSlot]).toBe(150);
    const ids = next.franchise!.teams.flatMap((team) =>
      ROSTER_SLOTS.map((slot) => team.roster[slot]),
    );
    expect(ids).toHaveLength(240);
    expect(new Set(ids).size).toBe(240);
    expect(new Set(ids)).toEqual(
      new Set(franchise.teams.flatMap((team) => Object.values(team.roster))),
    );
    for (const team of [
      next.franchise!.teams[0],
      next.franchise!.teams[target.teamId],
    ])
      expect(team.ratings).toEqual(
        teamRatings(team.roster, team.tactic, team.rotation),
      );
    expect(next.franchise!.trades).toEqual([
      { year: 1, teamId: target.teamId, giveId: 150, receiveId: target.id },
    ]);
    expect(next.run).toBe(offseason.run);
    expect(next.records).toBe(offseason.records);
    expect(next.franchise!.history).toEqual(franchise.history);
    expect(next.franchise!.careers).toEqual(franchise.careers);
    expect(offseason).toEqual(before);
  });

  it("accepts competitive offers between players with similar basketball ability", () => {
    const franchise = enterOffseason(finished).franchise!;
    const offers = franchise.teams
      .slice(1)
      .flatMap((team) =>
        ROSTER_SLOTS.flatMap((slot) =>
          [149, 68, 143, 9, 94, 59].map((giveId) => ({
            giveId,
            receiveId: team.roster[slot]!,
            teamId: team.id,
          })),
        ),
      )
      .filter(
        (offer) =>
          Math.abs(ability(offer.giveId) - ability(offer.receiveId)) < 1,
      );
    expect(offers.length).toBeGreaterThan(0);
    expect(
      offers.some(
        (offer) =>
          evaluateTrade(franchise, offer.teamId, offer.giveId, offer.receiveId)
            .accepted,
      ),
    ).toBe(true);
  });
});

describe("career identity across franchise seasons", () => {
  it("adds a traded species' live and archived second year once, with highs as maxima", () => {
    const first = enterOffseason(finished);
    const target = partnerPlayer(first.franchise!, false);
    const traded = applyTrade(first, target.teamId, 150, target.id);
    const started = startFranchiseSeason(traded, 920);
    const result = simulateSeason(started.run);
    expect(result.modelVersion).toBe(4);
    const playoffs = simulatePlayoffs(result.league!, started.run.seasonSeed);
    const second = { ...started, run: { ...started.run, result, playoffs } };
    const snapshot = structuredClone(second);
    const live = careerPlayers(second.franchise!, second.run);
    const firstPlayer = finished.run.result!.league!.players.find(
      (player) => player.pokemonId === 150,
    )!;
    const secondPlayer = result.league!.players.find(
      (player) => player.pokemonId === 150,
    )!;
    expect(secondPlayer.teamId).toBe(target.teamId);
    const career = live.find((player) => player.pokemonId === 150)!;
    expect(career.seasons).toBe(2);
    expect(career.teamIds).toEqual([0, target.teamId]);
    expect(career.regular.gamesPlayed).toBe(164);
    expect(career.regular.points).toBe(
      firstPlayer.points + secondPlayer.points,
    );
    expect(career.regular.highPoints).toBe(
      Math.max(firstPlayer.highPoints, secondPlayer.highPoints),
    );
    const post = [finished.run.playoffs!, playoffs].flatMap((entry) =>
      entry.players.filter((player) => player.pokemonId === 150),
    );
    expect(career.playoffs.gamesPlayed).toBe(
      post.reduce((sum, player) => sum + player.gamesPlayed, 0),
    );
    expect(career.playoffs.points).toBe(
      post.reduce((sum, player) => sum + player.points, 0),
    );
    expect(career.playoffs.highPoints).toBe(
      Math.max(0, ...post.map((player) => player.highPoints)),
    );
    expect(live).toHaveLength(240);
    expect(second).toEqual(snapshot);
    const archived = enterOffseason(second);
    expect(archived.franchise!.history.map((entry) => entry.year)).toEqual([
      1, 2,
    ]);
    expect(archived.franchise!.careers).toEqual(live);
    expect(careerPlayers(archived.franchise!, archived.run)).toEqual(live);
    expect(enterOffseason(archived)).toBe(archived);
    expect(archived.franchise!.history[0].rosters[0]).toContain(150);
    expect(archived.franchise!.history[1].rosters[target.teamId]).toContain(
      150,
    );
    expect(archived.records).toBe(finished.records);
    career.regular.points = -1;
    expect(
      second.franchise!.careers.find((entry) => entry.pokemonId === 150)!
        .regular.points,
    ).toBe(firstPlayer.points);
    expect(
      archived.franchise!.careers.find((entry) => entry.pokemonId === 150)!
        .regular.points,
    ).toBeGreaterThan(0);
  }, 600000);
});

it("does not create seasons or trades beyond the supported save boundaries", () => {
  const state = enterOffseason(finished),
    franchise = state.franchise!;
  const lastYear = {
    ...state,
    franchise: {
      ...franchise,
      year: 1000,
      history: Array.from({ length: 1000 }, (_, i) => ({
        ...franchise.history[0],
        year: i + 1,
      })),
    },
  };
  expect(startFranchiseSeason(lastYear, 999)).toBe(lastYear);
  const partner = partnerPlayer(franchise, false);
  const offer = {
    year: 1,
    teamId: partner.teamId,
    giveId: 150,
    receiveId: partner.id,
  };
  expect(
    evaluateTrade(franchise, partner.teamId, 150, partner.id).accepted,
  ).toBe(true);
  const limited = {
    ...state,
    franchise: {
      ...franchise,
      trades: Array.from({ length: 10000 }, () => offer),
    },
  };
  expect(
    evaluateTrade(limited.franchise, partner.teamId, 150, partner.id).accepted,
  ).toBe(false);
  expect(applyTrade(limited, partner.teamId, 150, partner.id)).toBe(limited);
});
