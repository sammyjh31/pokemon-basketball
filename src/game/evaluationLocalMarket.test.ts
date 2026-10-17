import { expect, it } from "vitest";
import * as local from "./localLeague";
import * as career from "./localCareer";
import { simulateLocalSeason } from "./localSeason";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import { selectLocalCoach, localCoachTurn } from "./coachSelection";
import { recommendRosterPicks } from "./draftAdvice";
import { compareTeamEvaluation } from "./teamEvaluation";
import { projectedCoaches, officeAssignments } from "./coachOffice";
import { appointLocalCoach } from "./coachLocal";
import { COACHES } from "./trainerCoaches";
import { exchangePlayers } from "./rosterTrades";
import { ROSTER_SLOTS, POSITIONS } from "./types";
import { positionRating } from "./ratings";
import { POKEMON_BY_ID } from "../data/pokemon";
import { createRivalStrategy } from "./rivalRosterStrategy";
function offseason(mode: "full-pool" | "generational") {
  let draft = local.createLocalLeague(
    [
      { name: "A", teamId: 0 },
      { name: "B", teamId: 1 },
    ],
    true,
    71,
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
  draft.coachDraftRequired = true;
  while (localCoachTurn(draft)) {
    const turn = localCoachTurn(draft)!;
    draft = selectLocalCoach(
      draft,
      turn.teamId,
      turn.teamId === 0 ? "brock" : "misty",
    );
  }
  while (local.currentLocalTurn(draft)) {
    draft = local.advanceLocalCpu(draft);
    const turn = local.currentLocalTurn(draft);
    if (!turn) break;
    const club = local.localLeagueTeams(draft)[turn.teamId],
      pool = local
        .localLeaguePool(draft)
        .filter((p) => !draft.picks.some((x) => x.pokemonId === p.id));
    const pick = recommendRosterPicks(
      pool,
      club.roster,
      club.tactic,
      1,
      club,
    )[0];
    draft = local.pickLocalPlayer(draft, pick.pokemonId, pick.slot);
  }
  const result = simulateLocalSeason(draft),
    playoffs = simulatePlayoffs(result.league!, career.localSeasonSeed(draft));
  return career.beginLocalOffseason(
    { ...draft, completed: true, playoffGames: playoffGameCount(playoffs) },
    result,
    playoffs,
  );
}
it("values local rookie replacements with developed shared roster value and the appointed coach", () => {
  let draft = offseason("generational");
  const turn = career.currentLocalRookieTurn(draft)!;
  const free = COACHES.find(
    (c) =>
      !officeAssignments(draft.career!.coachOffice!.years[0]).includes(c.id) &&
      c.id !== "brock",
  )!;
  draft = appointLocalCoach(draft, turn.teamId, free.id);
  const f = draft.career!,
    teams = projectedCoaches(f.teams, f.coachOffice, f.year),
    club = teams[turn.teamId];
  const choice = career.recommendedLocalRookie(draft)!;
  const slot = ROSTER_SLOTS.find((s) => club.roster[s] === choice.releasedId)!;
  const development = { ...club.development, [choice.pokemonId]: {} };
  delete development[choice.releasedId];
  const comparison = compareTeamEvaluation(club, {
    ...club,
    roster: { ...club.roster, [slot]: choice.pokemonId },
    development,
  });
  const rival = createRivalStrategy(club, teams, f.history, f.year).change(
    [choice.releasedId],
    [choice.pokemonId],
  );
  expect(choice.score).toBeCloseTo(comparison.delta + rival, 10);
  expect(choice.reason).toContain("Shared team value");
});
it("uses the same developed roster delta for both sides of a local trade and exposes its factors", () => {
  let draft = offseason("full-pool");
  const free = COACHES.find(
    (c) =>
      !officeAssignments(draft.career!.coachOffice!.years[0]).includes(c.id),
  )!;
  draft = appointLocalCoach(draft, 0, free.id);
  const f = draft.career!,
    teams = projectedCoaches(f.teams, f.coachOffice, f.year),
    give = teams[0].roster.PG!,
    receive = teams[2].roster.C!;
  const next = exchangePlayers(teams, 0, 2, give, receive),
    a = compareTeamEvaluation(teams[0], next[0]),
    b = compareTeamEvaluation(teams[2], next[2]);
  const result = career.evaluateLocalTrade(draft, 0, 2, give, receive);
  expect(result.fromGain).toBeCloseTo(a.delta, 10);
  expect(result.toGain).toBeCloseTo(b.delta, 10);
  expect(result.fromFactors).toEqual(a.factors);
  expect(result.toFactors).toEqual(b.factors);
  expect(result.reason).toContain("Shared team value");
  expect(result.reason).toContain(
    `${a.before.toFixed(1)} → ${a.after.toFixed(1)}`,
  );
  expect(result.reason).toContain(
    [...a.factors].sort(
      (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
    )[0].label,
  );
  expect(
    local.localLeagueRun(career.startNextLocalSeason(draft)).coach?.id,
  ).toBe(free.id);
});
it("restores a recorded local trade after a later coaching appointment without weakening ownership and consent validation", () => {
  const source = offseason("full-pool"),
    f = source.career!,
    row = f.coachOffice!.years[0],
    ids = officeAssignments(row);
  let found:
    { draft: local.LocalLeague; give: number; receive: number } | undefined;
  for (const give of Object.values(f.teams[0].roster))
    for (const receive of Object.values(f.teams[2].roster)) {
      if (!career.evaluateLocalTrade(source, 0, 2, give!, receive!).accepted)
        continue;
      for (const coach of COACHES.filter((c) => !ids.includes(c.id))) {
        const changed = structuredClone(source);
        changed.career!.coachOffice!.years[0].changes.push({
          teamId: 2,
          from: ids[2],
          to: coach.id,
          source: "cpu",
          reason: "Appointed after the recorded trade.",
        });
        if (
          !career.evaluateLocalTrade(changed, 0, 2, give!, receive!).accepted
        ) {
          found = { draft: changed, give: give!, receive: receive! };
          break;
        }
      }
      if (found) break;
    }
  expect(found).toBeDefined();
  const saved = career.applyLocalTrade(
    source,
    0,
    2,
    found!.give,
    found!.receive,
    [0],
  );
  saved.career!.coachOffice = found!.draft.career!.coachOffice;
  expect(local.parseLocalLeague(JSON.stringify(saved))).toEqual(saved);
  const badOwner = structuredClone(saved);
  badOwner.career!.history[0].trades[0].giveId = 9999;
  expect(() => local.parseLocalLeague(JSON.stringify(badOwner))).toThrow();
  const badConsent = structuredClone(saved);
  badConsent.career!.history[0].trades[0].acceptedByTeamIds = [];
  expect(() => local.parseLocalLeague(JSON.stringify(badConsent))).toThrow();
}, 30000);

it("keeps talent loss as a fairness guard instead of a second modern team-value formula", () => {
  const draft = offseason("full-pool"),
    f = draft.career!;
  const teams = projectedCoaches(f.teams, f.coachOffice, f.year),
    from = teams[0],
    to = teams[2];
  const best = (team: typeof from, id: number) =>
    Math.max(
      ...POSITIONS.map((p) =>
        positionRating(POKEMON_BY_ID.get(id)!, p, team.development?.[id]),
      ),
    );
  const strategy = createRivalStrategy(to, teams, f.history, f.year);
  for (const give of Object.values(from.roster))
    for (const receive of Object.values(to.roster)) {
      const next = exchangePlayers(teams, 0, 2, give!, receive!);
      const gain = compareTeamEvaluation(to, next[2]).delta;
      const rival = strategy.tradeChange([receive!], [give!], 0);
      const talent = best(from, give!) - best(to, receive!);
      expect(
        career.evaluateLocalTrade(draft, 0, 2, give!, receive!).accepted,
      ).toBe(gain >= -0.15 && talent >= -5 && gain + rival >= -0.15);
    }
});
