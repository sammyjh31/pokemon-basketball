import { POKEMON_BY_ID } from "../data/pokemon";
import {
  coachTrainingPlans,
  type CoachTrainingAssignment,
} from "../game/coachTraining";
import { getCoach } from "../game/trainerCoaches";
import {
  TRAINING_FOCUS_LABELS,
  TRAINING_INTENSITY_LABELS,
} from "../game/training";
import {
  ROSTER_SLOTS,
  type LeaguePlayer,
  type LeagueTeam,
} from "../game/types";
import { CoachPortrait } from "./CoachPortrait";
import { Portrait } from "./Portrait";
import "../coaching.css";

const focusLabel = ({ plan }: CoachTrainingAssignment) =>
  plan.focus === "position"
    ? `${plan.position} position practice`
    : TRAINING_FOCUS_LABELS[plan.focus];

export function CoachTrainingDetails({
  assignment,
}: {
  assignment: CoachTrainingAssignment;
}) {
  return (
    <div className="coach-training-reasons">
      <p>
        <strong>{getCoach(assignment.coachId)?.name}</strong> ·{" "}
        {focusLabel(assignment)} ·{" "}
        {TRAINING_INTENSITY_LABELS[assignment.plan.intensity]}
      </p>
      <ul>
        {assignment.reasons.map((reason, i) => (
          <li key={i}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}

export function CoachTrainingPanel({
  team,
  players,
}: {
  team: LeagueTeam;
  players?: LeaguePlayer[];
}) {
  const coach = getCoach(team.coach?.id ?? "");
  if (!coach)
    return (
      <p className="notice">
        Hire a head coach in the Coaches tab to set automatic training plans.
      </p>
    );
  const plans = coachTrainingPlans(team, players);
  return (
    <section
      className="coaching-editor"
      aria-label="Automatic individual training"
    >
      <div className="coaching-heading">
        <div className="coaching-player">
          <CoachPortrait coach={coach} size="small" />
          <div>
            <span className="eyebrow">NEXT CAMP · AUTOMATIC</span>
            <h3>{coach.name}'s training plans</h3>
          </div>
        </div>
        <span className="coaching-badge">
          All eight players · no setup needed
        </span>
      </div>
      <p>
        Your trainer balances their style, each Pokémon’s developed skills and
        role, and the team’s needs. These previews update with roster moves and
        development. Final intensity also accounts for minutes played during the
        season.
      </p>
      <p>
        Training applies when you enter the offseason, before offseason coaching
        changes. A new hire directs the next camp; completed camps stay in
        Development report. Focus redirects a limited practice budget, and
        intensity changes the chance of large gains or setbacks.
      </p>
      <div className="training-grid">
        {ROSTER_SLOTS.map((slot) => {
          const mon = POKEMON_BY_ID.get(team.roster[slot]!);
          const assignment = mon && plans[mon.id];
          return mon && assignment ? (
            <article
              className="training-player coach-training-player"
              aria-label={`${mon.name} automatic training`}
              key={mon.id}
            >
              <div className="coaching-player">
                <Portrait mon={mon} />
                <div>
                  <strong>{mon.name}</strong>
                  <small>{focusLabel(assignment)}</small>
                </div>
              </div>
              <span className="coach-training-intensity">
                {TRAINING_INTENSITY_LABELS[assignment.plan.intensity]}
              </span>
              <details>
                <summary>Why this plan?</summary>
                <CoachTrainingDetails assignment={assignment} />
              </details>
            </article>
          ) : null;
        })}
      </div>
    </section>
  );
}
