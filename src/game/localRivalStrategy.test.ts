import { beforeAll, describe, expect, it } from "vitest";
import {
  advanceLocalCpu,
  createLocalLeague,
  currentLocalTurn,
  localLeaguePool,
  parseLocalLeague,
  pickLocalPlayer,
  type LocalLeague,
} from "./localLeague";
import {
  beginLocalOffseason,
  applyLocalTrade,
  parseLocalCareer,
  currentLocalRookieTurn,
  evaluateLocalTrade,
  localSeasonSeed,
  pickLocalRookie,
  recommendedLocalRookie,
  replayLocalHistory,
  startNextLocalSeason,
} from "./localCareer";
import { simulateLocalSeason } from "./localSeason";
import { playoffGameCount, simulatePlayoffs } from "./playoffs";
import { ROSTER_SLOTS } from "./types";

function drafted(
  mode: "generational" | "full-pool",
  seed = 42,
  originalRules = false,
): LocalLeague {
  let draft = createLocalLeague(
    [
      { name: "Sam", teamId: 1 },
      { name: "Alex", teamId: 3 },
    ],
    true,
    seed,
    2,
    {
      mode,
      format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
      engineRules: {
        version: 1,
        abilities: true,
        adaptiveCoaching: true,
        familiarity: 0,
      },
    },
  );
  // These fixtures preserve the policies before shared team evaluation.
  delete draft.movesetVersion;
  delete draft.abilityMasteryVersion;
  delete draft.gameFlowVersion;
  delete draft.evaluationVersion;
  delete draft.physicalAbilityVersion;
  delete draft.chemistryVersion;
  delete draft.chemistryGrowthVersion;
  delete draft.moraleVersion;
  delete draft.personalityVersion;
  // Exact counterexample choices below belong to the original frozen season rules.
  if (originalRules) delete draft.abilityVersion;
  if (originalRules) delete draft.courtVersion;
  if (originalRules) delete draft.matchupVersion;
  if (originalRules) delete draft.possessionVersion;
  while (currentLocalTurn(draft)) {
    draft = advanceLocalCpu(draft);
    const turn = currentLocalTurn(draft);
    if (!turn) break;
    const mon = localLeaguePool(draft).find(
      (p) => !draft.picks.some((pick) => pick.pokemonId === p.id),
    )!;
    const slot = ROSTER_SLOTS.find(
      (slot) =>
        !draft.picks.some(
          (pick) => pick.teamId === turn.teamId && pick.slot === slot,
        ),
    )!;
    draft = pickLocalPlayer(draft, mon.id, slot);
  }
  return draft;
}

function finish(draft: LocalLeague) {
  const result = simulateLocalSeason(draft);
  const playoffs = simulatePlayoffs(result.league!, localSeasonSeed(draft));
  return {
    result,
    playoffs,
    draft: {
      ...draft,
      completed: true,
      playoffGames: playoffGameCount(playoffs),
    },
  };
}

let full: ReturnType<typeof finish>;
let generational: ReturnType<typeof finish>;
beforeAll(() => {
  full = finish(drafted("full-pool"));
  generational = finish(drafted("generational", 42, true));
});

describe("local rival roster learning", () => {
  it("uses learned matchups to retain a counter in a close CPU rookie decision", () => {
    const completed = finish(drafted("generational", 13, true));
    const source = beginLocalOffseason(
      completed.draft,
      completed.result,
      completed.playoffs,
    );
    const old = structuredClone(source);
    delete old.career!.history[0].rivalScouting;
    const finishDraft = (draft: LocalLeague) => {
      while (currentLocalRookieTurn(draft)) {
        const choice = recommendedLocalRookie(draft)!;
        draft = pickLocalRookie(draft, choice.pokemonId, choice.releasedId);
      }
      return draft;
    };
    const learned = finishDraft(source),
      unscouted = finishDraft(old);
    expect(learned.career!.history[0].rookiePicks[6]).toEqual({
      teamId: 2,
      pokemonId: 243,
      releasedId: 94,
    });
    expect(unscouted.career!.history[0].rookiePicks[6]).toEqual({
      teamId: 2,
      pokemonId: 243,
      releasedId: 121,
    });
    expect(parseLocalLeague(JSON.stringify(learned))).toEqual(learned);
    expect(source.career!.history[0].rookiePicks).toEqual([]);
  });
  it("accepts a marginal CPU trade for its own learned need and replays that decision on reload", () => {
    const completed = finish(drafted("full-pool", 5, true));
    const source = beginLocalOffseason(
      completed.draft,
      completed.result,
      completed.playoffs,
    );
    const before = JSON.stringify(source);
    const old = structuredClone(source);
    delete old.career!.history[0].rivalScouting;
    expect(evaluateLocalTrade(old, 0, 2, 1008, 491).accepted).toBe(false);
    const evaluation = evaluateLocalTrade(source, 0, 2, 1008, 491);
    expect(evaluation.accepted).toBe(true);
    expect(evaluation.fromRivalGain).toBeLessThan(0);
    expect(evaluation.toRivalGain).toBeGreaterThan(0);
    expect(evaluation.fromGain).toBeGreaterThanOrEqual(-0.15);
    expect(evaluation.toGain).toBeGreaterThanOrEqual(-0.15);
    const traded = applyLocalTrade(source, 0, 2, 1008, 491);
    expect(parseLocalLeague(JSON.stringify(traded))).toEqual(traded);
    expect(
      evaluateLocalTrade(parseLocalLeague(before), 0, 2, 1008, 491),
    ).toEqual(evaluation);
    expect(JSON.stringify(source)).toBe(before);
  });
  it("archives all completed encounters, including the final, through reload and the following season", () => {
    const before = JSON.stringify(full);
    const saved = beginLocalOffseason(full.draft, full.result, full.playoffs);
    const report = saved.career!.history[0].rivalScouting!;
    expect(report).toBeDefined();
    expect(report.version).toBe(1);
    const records = Object.values(report.teams).flat();
    expect(records.reduce((sum, record) => sum + record.games, 0)).toBe(62);
    expect(records.reduce((sum, record) => sum + record.playoffGames, 0)).toBe(
      6,
    );
    expect(records.reduce((sum, record) => sum + record.losses, 0)).toBe(31);
    expect(records.every((record) => record.threats.length > 0)).toBe(true);
    const restored = parseLocalLeague(JSON.stringify(saved));
    expect(restored.career!.history[0].rivalScouting).toEqual(report);
    expect(replayLocalHistory(restored, 1).result).toEqual(full.result);
    const next = startNextLocalSeason(restored);
    const second = finish(next);
    const secondSaved = beginLocalOffseason(
      second.draft,
      second.result,
      second.playoffs,
    );
    expect(
      parseLocalLeague(JSON.stringify(secondSaved)).career!.history[0]
        .rivalScouting,
    ).toEqual(report);
    expect(secondSaved.career!.history[1].rivalScouting).toBeDefined();
    expect(JSON.stringify(full)).toBe(before);
  });

  it("rejects malformed scouting instead of ignoring an untrusted optional field", () => {
    const saved = beginLocalOffseason(full.draft, full.result, full.playoffs);
    for (const value of [
      undefined,
      null,
      { version: 2, teams: {} },
      {
        version: 1,
        teams: {
          0: [{ teamId: 0, games: 5, losses: 1, playoffGames: 0, threats: [] }],
        },
      },
    ]) {
      const invalid = structuredClone(saved);
      invalid.career!.history[0].rivalScouting = value as never;
      expect(() =>
        parseLocalCareer(
          invalid.career,
          full.draft,
          true,
          full.draft.playoffGames,
        ),
      ).toThrow();
    }
  });

  it("checks a structurally valid report against the frozen games during archive replay", () => {
    const saved = beginLocalOffseason(full.draft, full.result, full.playoffs);
    expect(saved.career!.history[0].rivalScouting).toBeDefined();
    const invalid = structuredClone(saved);
    const threat = Object.values(
      invalid.career!.history[0].rivalScouting!.teams,
    ).flat()[0].threats[0];
    threat.points -= 1;
    const restored = parseLocalLeague(JSON.stringify(invalid));
    expect(() => replayLocalHistory(restored, 1)).toThrow(
      /scouting|frozen inputs/i,
    );
  });

  it("preserves old archive decisions and leaves new metadata absent when there is no report", () => {
    const old = beginLocalOffseason(
      generational.draft,
      generational.result,
      generational.playoffs,
    );
    delete old.career!.history[0].rivalScouting;
    const restored = parseLocalLeague(JSON.stringify(old));
    expect(restored.career!.history[0]).not.toHaveProperty("rivalScouting");
    const choice = recommendedLocalRookie(restored)!;
    expect(choice).not.toHaveProperty("rivalGain");
    expect(choice).not.toHaveProperty("reason");
    expect(choice).toEqual({
      pokemonId: 208,
      releasedId: 13,
      score: 58.18032444372573,
    });
    const previous = beginLocalOffseason(
      full.draft,
      full.result,
      full.playoffs,
    );
    delete previous.career!.history[0].rivalScouting;
    const teams = previous.career!.teams;
    const evaluation = evaluateLocalTrade(
      previous,
      1,
      0,
      teams[1].roster.PG!,
      teams[0].roster.PG!,
    );
    expect(evaluation).not.toHaveProperty("fromRivalGain");
    expect(evaluation).not.toHaveProperty("toRivalGain");
    expect(evaluation.accepted).toBe(false);
    expect(evaluation.requiresAcceptance).toEqual([1]);
  });

  it("keeps learned rookie choices deterministic through chronological reload without mutating the source", () => {
    const saved = beginLocalOffseason(
      generational.draft,
      generational.result,
      generational.playoffs,
    );
    const before = JSON.stringify(saved);
    const choice = recommendedLocalRookie(saved)!;
    expect(choice).toHaveProperty("rivalGain");
    expect(choice.reason).toMatch(/rival|against/i);
    expect(recommendedLocalRookie(parseLocalLeague(before))).toEqual(choice);
    let advanced = saved;
    while (currentLocalRookieTurn(advanced)) {
      const next = recommendedLocalRookie(advanced)!;
      advanced = pickLocalRookie(advanced, next.pokemonId, next.releasedId);
    }
    expect(parseLocalLeague(JSON.stringify(advanced))).toEqual(advanced);
    expect(
      new Set(
        advanced.career!.teams.flatMap((team) => Object.values(team.roster)),
      ).size,
    ).toBe(32);
    expect(JSON.stringify(saved)).toBe(before);
  });

  it("evaluates each club's learned need while preserving human approval and CPU roster protection", () => {
    const saved = beginLocalOffseason(full.draft, full.result, full.playoffs);
    const before = JSON.stringify(saved);
    const teams = saved.career!.teams;
    const give = teams[1].roster.PG!;
    const receive = teams[0].roster.PG!;
    const declined = evaluateLocalTrade(saved, 1, 0, give, receive);
    expect(declined).toHaveProperty("fromRivalGain");
    expect(declined).toHaveProperty("toRivalGain");
    expect(declined.accepted).toBe(false);
    expect(declined.toGain).toBeLessThan(-0.15);
    const reversed = evaluateLocalTrade(saved, 0, 1, receive, give);
    expect(reversed.fromRivalGain).toBe(declined.toRivalGain);
    expect(reversed.toRivalGain).toBe(declined.fromRivalGain);
    expect(
      evaluateLocalTrade(parseLocalLeague(before), 1, 0, give, receive),
    ).toEqual(declined);
    const humanReceive = teams[3].roster.PG!;
    const humans = evaluateLocalTrade(saved, 1, 3, give, humanReceive);
    expect(humans.accepted).toBe(true);
    expect(humans.requiresAcceptance).toEqual([1, 3]);
    expect(humans.reason).toContain(teams[1].name);
    expect(humans.reason).toContain(teams[3].name);
    expect(() => applyLocalTrade(saved, 1, 3, give, humanReceive, [1])).toThrow(
      /agree/,
    );
    const traded = applyLocalTrade(saved, 1, 3, give, humanReceive, [1, 3]);
    expect(parseLocalLeague(JSON.stringify(traded))).toEqual(traded);
    expect(JSON.stringify(saved)).toBe(before);
  });
});
