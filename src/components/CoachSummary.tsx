import { getCoach } from "../game/trainerCoaches";
import { coachGamePlan, coachRotationMinutes } from "../game/coachPolicy";
import { POKEMON_BY_ID } from "../data/pokemon";
import { TACTIC_LABELS, DEFENSE_LABELS, type LeagueTeam } from "../game/types";
import "../coaches.css";
export function CoachSummary({
  team,
  nextSeason = false,
}: {
  team: LeagueTeam;
  nextSeason?: boolean;
}) {
  const c = getCoach(team.coach?.id ?? "");
  if (!c) return null;
  const complete = Object.values(team.roster).every((id) => id !== null);
  const plan = coachGamePlan(team),
    minutes = complete ? coachRotationMinutes(team) : undefined;
  return (
    <section
      className="coach-summary"
      aria-label={`${c.name} automatic coaching`}
    >
      <span className="eyebrow">
        {nextSeason ? "Next season's head coach" : "Your head coach"} ·
        Automatic coaching
      </span>
      <h2>
        {c.name} <small>{c.style}</small>
      </h2>
      <p>
        {c.description} Starters and closers are selected by role fit, matchups,
        fatigue and fouls.
      </p>
      <div className="coach-tags">
        <span>{TACTIC_LABELS[plan.tactic]}</span>
        <span>{DEFENSE_LABELS[plan.defense]}</span>
        <span>Preferred screen coverage: {c.coverage}</span>
      </div>
      <p className="coach-footnote">
        You manage roster moves and optional training. Your trainer handles game
        plans and substitutions.{" "}
        {nextSeason
          ? "Takes over at the next season boundary."
          : "Plans adjust for each opponent and during games."}
      </p>
      {minutes && (
        <details>
          <summary>Projected rotation · 240 minutes</summary>
          <p className="coach-footnote">
            Targets guide substitutions; actual minutes change with matchups,
            fatigue, fouls and overtime. Roster slots do not guarantee a
            starting place.
          </p>
          <div className="coach-minutes">
            {Object.entries(minutes)
              .sort((a, b) => b[1] - a[1])
              .map(([slot, min]) => (
                <span key={slot}>
                  {
                    POKEMON_BY_ID.get(
                      team.roster[slot as keyof typeof team.roster]!,
                    )!.name
                  }
                  <b>{min} min</b>
                </span>
              ))}
          </div>
        </details>
      )}
    </section>
  );
}
