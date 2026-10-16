import { changeCoach, reviewCpuCoaches } from "./coachOffice";
import { franchiseCoachRecords } from "./coachCareers";
import type { GameState } from "./types";
export function reviewFranchiseCoaches(state: GameState): GameState {
  const f = state.franchise,
    h = f?.history.at(-1);
  if (!f || f.phase !== "offseason" || !h || !f.teams.every((t) => t.coach))
    return state;
  const coachOffice = reviewCpuCoaches(f.coachOffice, {
    teams: f.teams,
    standings: h.standings,
    year: f.year,
    seed: h.seasonSeed,
    humanTeamIds: [0],
    championId: h.championId,
    finalistIds: [h.championId, h.runnerUpId],
    priorRecords: franchiseCoachRecords(f),
  });
  return coachOffice === f.coachOffice
    ? state
    : { ...state, franchise: { ...f, coachOffice } };
}
export function appointFranchiseCoach(
  state: GameState,
  id: string | null,
): GameState {
  if (
    state.franchise?.phase !== "offseason" ||
    !state.franchise.teams.every((t) => t.coach)
  )
    return state;
  const ready = reviewFranchiseCoaches(state),
    f = ready.franchise!;
  try {
    const coachOffice = changeCoach(f.coachOffice, f.teams, f.year, 0, id, [0]);
    return { ...ready, franchise: { ...f, coachOffice } };
  } catch {
    return state;
  }
}
