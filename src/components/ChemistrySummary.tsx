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
  return (
    <div className="chemistry-details">
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
        Cohesion describes the five’s basketball balance. Partnerships supply
        bounded passing, movement, screen, coverage, rebound and energy
        modifiers; these are opportunities, not points scored.
      </p>
    </section>
  );
}
