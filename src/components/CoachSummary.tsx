import {
  createEvaluationContext,
  evaluatePlayer,
} from "../game/teamEvaluation";
import { getCoach } from "../game/trainerCoaches";
import { CoachPortrait } from "./CoachPortrait";
import { coachGamePlan, coachRotationMinutes } from "../game/coachPolicy";
import { POKEMON_BY_ID } from "../data/pokemon";
import { TACTIC_LABELS, DEFENSE_LABELS, type LeagueTeam } from "../game/types";
import "../coaches.css";
import { ProjectedChemistrySummary } from "./ChemistrySummary";
import { CoachScoutingSummary } from "./CoachScoutingSummary";
import { MoralePanel } from "./MoralePanel";
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
  const context =
    team.evaluationVersion === 1 ? createEvaluationContext(team) : undefined;
  const evaluations = context
    ? Object.values(team.roster)
        .flatMap((id) => (id == null ? [] : [evaluatePlayer(context, id)]))
        .sort((a, b) => b.score - a.score)
    : [];
  return (
    <section
      className="coach-summary"
      aria-label={`${c.name} automatic coaching`}
    >
      <div className="coach-identity">
        <CoachPortrait coach={c} />
        <div>
          <span className="eyebrow">
            {nextSeason ? "Next season's head coach" : "Your head coach"} ·
            Automatic coaching
          </span>
          <h2>
            {c.name} <small>{c.style}</small>
          </h2>
        </div>
      </div>
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
        You manage roster moves. Your trainer handles individual training, game
        plans and substitutions.{" "}
        {nextSeason
          ? "Takes over at the next season boundary."
          : "Plans adjust for each opponent and during games."}
      </p>
      <ProjectedChemistrySummary team={team} plan={plan} />
      <MoralePanel team={team} />
      {!nextSeason && <CoachScoutingSummary team={team} />}
      {context && evaluations.length > 0 && (
        <details className="coach-evaluation">
          <summary>How your coach values this roster</summary>
          <p className="coach-footnote">
            Team value combines basketball talent, role fit, scheme, roster
            needs and ability usefulness. The same assessment guides recruiting,
            trades, minutes and training. It changes with your coach and roster;
            OVR remains a separate rating. These values use each player’s
            strongest role.
            {context.physicalAbilities &&
              " Physical ability fit includes usable movement, screens, rebounding and energy benefits; training can improve the skills that put them to use."}
          </p>
          <p className="coach-evaluation-hint">
            Scroll across to see every contribution.
          </p>
          <div
            className="coach-evaluation-scroll"
            role="region"
            aria-label="Shared team evaluation"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Pokémon</th>
                  <th scope="col">Role</th>
                  <th scope="col">Team value</th>
                  {evaluations[0].factors.map((f) => (
                    <th scope="col" key={f.key}>
                      {f.key === "role" ? "Role contribution" : f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evaluations.map((p) => (
                  <tr key={p.pokemonId}>
                    <th scope="row">{POKEMON_BY_ID.get(p.pokemonId)!.name}</th>
                    <td>{p.role}</td>
                    <td>
                      <strong>{p.score.toFixed(1)}</strong>
                    </td>
                    {p.factors.map((f) => (
                      <td key={f.key}>{f.contribution.toFixed(1)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="coach-footnote">
            Columns show contributions to team value. Actual playing time also
            depends on stamina, matchups, fouls and game situation.
          </p>
        </details>
      )}
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
