import type { Franchise } from "./franchiseTypes";
import { validateRosterTransactions } from "./franchiseTransactions";
import {
  beginRookieDraft,
  recommendedRookiePick,
  selectRookie,
} from "./rookieDraft";
import { rookieFixture } from "./rookieDraft.testUtils";
import { createRun, placePokemon } from "./draft";
import { createLeague } from "./league";
import { ROSTER_SLOTS, type GameState, type Standing } from "./types";

/** The shared offseason fixture under CPU rules v1. */
export function governed(): GameState {
  const state = rookieFixture();
  state.franchise!.cpuRules = { modelVersion: 1, since: 1 };
  return state;
}

/** The same offseason with a current coached league (shared evaluation). */
export function modernGoverned(): GameState {
  const state = governed(),
    f = state.franchise!;
  let run: GameState["run"] = {
    ...createRun("free", false, 82),
    coach: { version: 1, id: "misty" },
  };
  [129, 25, 149, 68, 143, 9, 94, 59].forEach((id, index) => {
    run = placePokemon(run, id, ROSTER_SLOTS[index]);
  });
  const teams = createLeague(run);
  f.teams = teams;
  f.history[0].rosters = teams.map((team) =>
    ROSTER_SLOTS.map((slot) => team.roster[slot]!),
  );
  f.history[0].finalsMvp = {
    ...f.history[0].finalsMvp,
    pokemonId: teams[29].roster.PG!,
    playerId: `29:${teams[29].roster.PG}`,
  };
  return { ...state, run };
}

/** Complete the draft with the user taking the recommendation each turn. */
export function drafted(state = governed()): GameState {
  let next = beginRookieDraft(state);
  while (!next.franchise!.rookieDrafts!.at(-1)!.complete) {
    const pick = recommendedRookiePick(next.franchise!, 0, false)!;
    next = selectRookie(next, pick.pokemonId, pick.releasedId);
  }
  return next;
}

export function transactions(f: Franchise) {
  return validateRosterTransactions(
    structuredClone(f.rookieDrafts),
    f.history,
    f.trades,
    f.teams.map((team) => ROSTER_SLOTS.map((slot) => team.roster[slot]!)),
    false,
    f.year,
    f.phase,
    f.offseasons,
    f.freeAgency,
    f.cpuRules?.since,
  );
}

export function standings(wins: (id: number) => number): Standing[] {
  return Array.from({ length: 30 }, (_, teamId) => ({
    teamId,
    wins: wins(teamId),
    losses: 82 - wins(teamId),
    pointsFor: 8200,
    pointsAgainst: 8200,
    homeWins: 0,
    awayWins: 0,
    streak: 0,
    lastTen: 5,
  }));
}
