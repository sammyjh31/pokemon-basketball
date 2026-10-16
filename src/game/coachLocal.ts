import { changeCoach, reviewCpuCoaches } from "./coachOffice";
import { localCoachRecords } from "./coachCareers";
import type { LocalLeague } from "./localLeague";
export function reviewLocalCoaches(draft: LocalLeague): LocalLeague {
  const f = draft.career,
    h = f?.history.at(-1);
  if (!f || f.phase !== "offseason" || !h || !f.teams.every((t) => t.coach))
    return draft;
  const coachOffice = reviewCpuCoaches(f.coachOffice, {
    teams: f.teams,
    standings: h.standings,
    year: f.year,
    seed: h.seasonSeed,
    humanTeamIds: draft.managers.map((m) => m.teamId),
    championId: h.championId,
    // Older archives identify only the champion. Retain all CPUs rather than
    // risk dismissing an unknown runner-up; new seasons record both finalists.
    finalistIds:
      h.coachRecords
        ?.filter((r) => r.rounds.some((s) => s.finals))
        .map((r) => r.teamId) ?? f.teams.map((team) => team.id),
    priorRecords: localCoachRecords(f, f.teams),
  });
  return coachOffice === f.coachOffice
    ? draft
    : { ...draft, career: { ...f, coachOffice } };
}
export function appointLocalCoach(
  draft: LocalLeague,
  teamId: number,
  id: string | null,
): LocalLeague {
  if (
    draft.career?.phase !== "offseason" ||
    !draft.career.teams.every((t) => t.coach)
  )
    throw new Error("Coaching changes are available during the offseason.");
  const ready = reviewLocalCoaches(draft),
    f = ready.career!;
  const coachOffice = changeCoach(
    f.coachOffice,
    f.teams,
    f.year,
    teamId,
    id,
    draft.managers.map((m) => m.teamId),
  );
  return { ...ready, career: { ...f, coachOffice } };
}
