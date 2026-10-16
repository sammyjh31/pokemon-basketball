import type { MatchInsights } from "../game/engineInsightsTypes";
import { getCoach } from "../game/trainerCoaches";
import type { LeagueTeam } from "../game/types";
import { TACTIC_LABELS, DEFENSE_LABELS } from "../game/types";
import { POKEMON_BY_ID } from "../data/pokemon";
import { CoachPortrait } from "./CoachPortrait";
import "../coaches.css";
export function TrainerCoachInsights({
  insights,
  teams,
}: {
  insights: MatchInsights;
  teams: LeagueTeam[];
}) {
  if (!insights.coaches?.length) return null;
  return (
    <section className="insight-section">
      <h4>Trainer game plans</h4>
      <div className="coach-game-plans">
        {insights.coaches.map((row) => {
          const coach = getCoach(row.coachId);
          return (
            <article key={row.teamId}>
              <div className="coach-identity">
                {coach && <CoachPortrait coach={coach} size="small" />}
                <div>
                  <span className="eyebrow">
                    {teams.find((t) => t.id === row.teamId)?.name}
                  </span>
                  <h3>{coach?.name}</h3>
                </div>
              </div>
              <p>{row.reason}</p>
              <p>
                <b>Opening plan:</b> {TACTIC_LABELS[row.tactic]} ·{" "}
                {DEFENSE_LABELS[row.defense]}
              </p>
              <p>
                <b>Started:</b>{" "}
                {row.starters
                  .map((id) => POKEMON_BY_ID.get(id)?.name)
                  .join(", ")}
              </p>
              <p>
                {
                  insights.adjustments.filter((a) => a.teamId === row.teamId)
                    .length
                }{" "}
                tactical adjustments recorded below. Actual workloads are in the
                box score.
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
