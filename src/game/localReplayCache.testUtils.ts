import {
  advanceLocalCpu,
  createLocalLeague,
  currentLocalTurn,
  localLeaguePool,
  localLeagueTeams,
  pickLocalPlayer,
} from "./localLeague";
import {
  beginLocalOffseason,
  currentLocalRookieTurn,
  localRookiePool,
  localSeasonSeed,
  pickLocalRookie,
  startNextLocalSeason,
} from "./localCareer";
import { localCoachTurn, selectLocalCoach } from "./coachSelection";
import { simulateLocalSeason } from "./localSeason";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import { ROSTER_SLOTS } from "./types";

/** Real modern games, trainers, camps, two-round rookie drafts and transitions. */
export function localCareerFixture(years = 10, moves: boolean | 1 | 2 = true) {
  let draft = createLocalLeague(
    [
      { name: "Sam", teamId: 0 },
      { name: "Alex", teamId: 1 },
    ],
    true,
    19,
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
  );
  if (!moves) delete draft.movesetVersion;
  else if (moves !== true) draft.movesetVersion = moves;
  draft = { ...draft, coachDraftRequired: true };
  let selected = 0;
  for (let turn = localCoachTurn(draft); turn; turn = localCoachTurn(draft))
    draft = selectLocalCoach(draft, turn.teamId, ["ash", "misty"][selected++]);
  while (currentLocalTurn(draft)) {
    draft = advanceLocalCpu(draft);
    const turn = currentLocalTurn(draft);
    if (!turn) break;
    const taken = new Set(draft.picks.map((p) => p.pokemonId));
    const mon = localLeaguePool(draft).find((p) => !taken.has(p.id))!;
    const occupied = new Set(
      draft.picks.filter((p) => p.teamId === turn.teamId).map((p) => p.slot),
    );
    draft = pickLocalPlayer(
      draft,
      mon.id,
      ROSTER_SLOTS.find((s) => !occupied.has(s))!,
    );
  }
  for (let year = 1; year <= years; year++) {
    const result = simulateLocalSeason(draft);
    const playoffs = simulatePlayoffs(result.league!, localSeasonSeed(draft));
    draft = beginLocalOffseason(
      { ...draft, completed: true, playoffGames: playoffGameCount(playoffs) },
      result,
      playoffs,
    );
    for (
      let turn = currentLocalRookieTurn(draft);
      turn;
      turn = currentLocalRookieTurn(draft)
    ) {
      draft = pickLocalRookie(
        draft,
        localRookiePool(draft)[0].id,
        localLeagueTeams(draft)[turn.teamId].roster.PG!,
      );
    }
    if (year < years) draft = startNextLocalSeason(draft);
  }
  return draft;
}
