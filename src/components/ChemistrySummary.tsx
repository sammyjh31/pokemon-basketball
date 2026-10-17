import { POKEMON_BY_ID } from "../data/pokemon";
import { abilitiesEnabled } from "../game/abilities";
import type { LineupChemistry } from "../game/lineupChemistry";
import { projectedLineupChemistry } from "../game/teamEvaluation";
import {
  DEFENSE_LABELS,
  TACTIC_LABELS,
  type DefenseScheme,
  type LeagueTeam,
  type Tactic,
} from "../game/types";
import "../chemistry.css";

const name = (id: number) => POKEMON_BY_ID.get(id)?.name ?? `Pokémon ${id}`;

export function ChemistryDetails({
  chemistry,
}: {
  chemistry: LineupChemistry;
}) {
  const continuity = chemistry.continuity;
  const experienced =
    continuity?.pairs.filter((pair) => pair.minutes > 0).length ?? 0;
  return (
    <div className="chemistry-details">
      {chemistry.morale && (
        <p className="chemistry-morale">
          <strong>
            Active-five morale {chemistry.morale.score.toFixed(0)} / 100
          </strong>{" "}
          · {chemistry.morale.cohesionDelta > 0 ? "+" : ""}
          {chemistry.morale.cohesionDelta.toFixed(1)} temporary cohesion points.
          Earned shared minutes stay unchanged.
        </p>
      )}
      {chemistry.leadership && (
        <p className="chemistry-leadership">
          <strong>Captain {name(chemistry.leadership.captainId)}</strong> ·{" "}
          {chemistry.leadership.style} ·{" "}
          {chemistry.leadership.active ? (
            <>
              in the active five:{" "}
              {chemistry.leadership.cohesionDelta > 0 ? "+" : ""}
              {chemistry.leadership.cohesionDelta.toFixed(1)} temporary cohesion
              points.
            </>
          ) : (
            "off court: no captain cohesion bonus."
          )}{" "}
          Shared minutes are earned separately.
        </p>
      )}
      {continuity && (
        <div className="chemistry-familiarity">
          <strong>
            Earned familiarity {continuity.score.toFixed(0)} / 100
          </strong>
          <p>
            {continuity.sharedMinutes.toFixed(1)} average retained shared
            minutes across this five’s ten pairs.
          </p>
          <p>
            {experienced} experienced{" "}
            {experienced === 1 ? "connection" : "connections"} ·{" "}
            {continuity.pairs.length - experienced} new connections
          </p>
          <details>
            <summary>Shared court history by pair</summary>
            <ul className="chemistry-pairs">
              {continuity.pairs.map((pair) => (
                <li key={pair.pokemonIds.join(":")}>
                  <span>
                    {pair.pokemonIds.map(name).join(" + ")}:{" "}
                    {pair.minutes.toFixed(1)} retained shared minutes
                  </span>
                  <small>
                    {pair.minutes > 0
                      ? "Experienced connection"
                      : "New connection"}{" "}
                    · {(pair.bond * 100).toFixed(0)}% familiarity
                  </small>
                </li>
              ))}
            </ul>
          </details>
          <p>
            Familiarity grows from shared active court time in official games.
            Returning partners keep their connection; unfamiliar teammates begin
            at zero. Retained shared minutes decrease by 10% each offseason;
            they measure current familiarity, not lifetime playing time.
          </p>
        </div>
      )}
      <p>
        <strong>Strengths:</strong>{" "}
        {chemistry.strengths.join(" · ") ||
          "No standout strengths in this unit."}
      </p>
      <p>
        <strong>Gaps:</strong>{" "}
        {chemistry.weaknesses.join(" · ") || "No major coverage gaps."}
      </p>
      {chemistry.links.length > 0 ? (
        <ul className="chemistry-links">
          {chemistry.links.map((link) => (
            <li key={link.id}>
              <strong>{link.label}</strong>
              <span>{link.pokemonIds.map(name).join(" + ")}</span>
              <small>{link.description}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>No active ability combinations in this unit.</p>
      )}
    </div>
  );
}

export function ProjectedChemistrySummary({
  team,
  plan,
}: {
  team: LeagueTeam;
  plan?: { tactic: Tactic; defense: DefenseScheme };
}) {
  const projection = projectedLineupChemistry(team, plan);
  if (!projection) return null;
  return (
    <section
      className="projected-chemistry"
      aria-label="Projected five-player chemistry"
    >
      <div className="chemistry-heading">
        <h3>Projected five-player chemistry</h3>
        <strong>Cohesion {projection.chemistry.score.toFixed(0)} / 100</strong>
      </div>
      <p>
        Complementary skills and active partnerships guide this projection.
        Matchups, minutes, energy and fouls can change the five on court.
      </p>
      {projection.chemistry.skillScore !== undefined && (
        <p className="chemistry-scheme">
          Skill cohesion {projection.chemistry.skillScore.toFixed(0)} / 100 ·
          Earned familiarity adds to this basketball balance.
        </p>
      )}
      {plan && (
        <p className="chemistry-scheme">
          {TACTIC_LABELS[plan.tactic]} · {DEFENSE_LABELS[plan.defense]}
        </p>
      )}
      <ul className="chemistry-five">
        {projection.players.map((p) => (
          <li key={p.pokemonId}>
            <small>{p.role}</small>
            <strong>{name(p.pokemonId)}</strong>
          </li>
        ))}
      </ul>
      <ChemistryDetails chemistry={projection.chemistry} />
      {!abilitiesEnabled(team) && (
        <p>
          Ability combinations are disabled; basketball chemistry remains
          active.
        </p>
      )}
      <p className="chemistry-note">
        Cohesion describes the five’s basketball balance
        {projection.chemistry.continuity ? " and earned familiarity" : ""}.
        Partnerships supply bounded passing, movement, screen, coverage, rebound
        and energy modifiers; these are opportunities, not points scored.
      </p>
    </section>
  );
}
