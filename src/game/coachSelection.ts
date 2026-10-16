import type { GameState } from "./types";
import {
  assignLeagueCoaches,
  coachOffers,
  validateCoach,
} from "./trainerCoaches";
import { localLeagueTeams, type LocalLeague } from "./localLeague";
export function canSelectTrainer(state: GameState): boolean {
  if (state.run.coach || state.franchise?.pendingCoach) return false;
  if (state.franchise?.phase === "offseason")
    return !state.franchise.teams.some((t) => t.coach);
  return (
    !state.run.result && (state.run.seasonProgress?.completedRounds ?? 0) === 0
  );
}
export function selectTrainerCoach(state: GameState, id: string): GameState {
  const coach = validateCoach({ version: 1, id });
  if (!coach || !canSelectTrainer(state)) return state;
  if (state.franchise?.phase === "offseason")
    return { ...state, franchise: { ...state.franchise, pendingCoach: coach } };
  if (
    !state.franchise &&
    state.run.mode === "spin" &&
    !coachOffers(state.run.seasonSeed).some((c) => c.id === id)
  )
    return state;
  const run = { ...state.run, coach };
  delete run.coachDraftRequired;
  if (run.leagueTeams)
    run.leagueTeams = assignLeagueCoaches(
      run.leagueTeams,
      run.seasonSeed,
      new Map([[0, coach]]),
    );
  return {
    ...state,
    run,
    ...(state.franchise
      ? {
          franchise: {
            ...state.franchise,
            teams: structuredClone(run.leagueTeams!),
          },
        }
      : {}),
  };
}
export function localCoachTurn(draft: LocalLeague) {
  if (!draft.coachDraftRequired) return;
  return draft.order
    .map((id) => draft.managers.find((m) => m.teamId === id))
    .find((m) => m && !draft.coaching[m.teamId].coach);
}
export function selectLocalCoach(
  draft: LocalLeague,
  teamId: number,
  id: string,
): LocalLeague {
  const coach = validateCoach({ version: 1, id });
  if (
    !coach ||
    draft.picks.length ||
    draft.completed ||
    draft.career ||
    localCoachTurn(draft)?.teamId !== teamId ||
    draft.coaching.some((c) => c.coach?.id === id)
  )
    throw new Error("Choose an available trainer on your coach draft turn.");
  const next = {
    ...draft,
    coaching: draft.coaching.map((c, i) =>
      i === teamId ? { ...c, coach } : c,
    ),
  };
  if (!localCoachTurn(next)) {
    const selected = new Map(
      next.coaching.flatMap((c, i) => (c.coach ? [[i, c.coach] as const] : [])),
    );
    const teams = assignLeagueCoaches(
      localLeagueTeams(next),
      next.seed,
      selected,
    );
    next.coaching = next.coaching.map((c, i) => ({
      ...c,
      coach: teams[i].coach,
    }));
    delete next.coachDraftRequired;
  }
  return next;
}
