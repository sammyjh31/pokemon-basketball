import { POKEMON_BY_ID } from "../data/pokemon";
import { basketballMoves, movesEnabled } from "../game/basketballMoves";
import { coachMoves, specializationRules } from "../game/movePolicy";
import type { MoveAssignment } from "../game/moveTypes";
import type { LeagueTeam } from "../game/types";
import type { AbilityStatsRow } from "./AbilityStats";
const playerName = (id: number) =>
  POKEMON_BY_ID.get(id)?.name ?? `Pokémon #${id}`;
export function MovesetPanel({
  team,
  pokemonId,
  historical = false,
}: {
  team: LeagueTeam;
  pokemonId?: number;
  historical?: boolean;
}) {
  if (team.movesetVersion !== 1) return null;
  return (
    <section className="mastery-panel" aria-label="Basketball movesets">
      <h3>Basketball movesets</h3>
      <p>
        Your coach manages move selection, training and in-game timing
        automatically. Moves are basketball adaptations, with energy costs and
        cooldowns. Earned mastery follows Pokémon through trades and seasons.
      </p>
      <p>
        {historical
          ? "Assignments projected from this archived roster and pregame XP."
          : "Current coach assignments; new XP, roster needs or a coaching change can alter the selected moves and specialization without resetting progress."}
      </p>
      {!movesEnabled(team) ? (
        <p>
          Abilities are off, so basketball moves are disabled. Saved mastery is
          retained.
        </p>
      ) : (
        <ul className="mastery-roster">
          {Object.values(team.roster).flatMap((id) => {
            if (id == null || (pokemonId !== undefined && id !== pokemonId))
              return [];
            const plan = coachMoves(team, id),
              rules = specializationRules[plan.specialization];
            return [
              <li key={id}>
                <div className="mastery-heading">
                  <h4>{playerName(id)}</h4>
                  <span className="mastery-tier">{rules.name}</span>
                </div>
                <p>{rules.description}</p>
                <p>
                  {plan.moves.length} equipped moves · {plan.xp.toFixed(1)} XP.{" "}
                  {plan.nextSlot === null
                    ? "All four move slots unlocked."
                    : `Next move slot at ${plan.nextSlot} XP.`}{" "}
                  {plan.xp < 75
                    ? "Specializations unlock at 75 XP."
                    : "Your coach selects an unlocked specialization for each game."}
                </p>
                <ul>
                  {plan.moves.map((move) => (
                    <li key={move.id}>
                      <strong>{move.name}</strong> — {move.description}
                      <br />
                      <small>
                        {(move.cost * rules.cost).toFixed(1)} energy ·{" "}
                        {(move.cooldown * rules.cooldown).toFixed(0)} second
                        cooldown
                      </small>
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>Why these moves?</summary>
                  <ul>
                    {plan.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </details>
              </li>,
            ];
          })}
        </ul>
      )}
    </section>
  );
}
export function MoveUsage({ rows }: { rows: AbilityStatsRow[] }) {
  if (!rows.some((row) => row.abilityActivations?.moves)) return null;
  return (
    <section aria-label="Basketball move usage" className="mastery-panel">
      <h4>Basketball move usage</h4>
      <p>
        Actual activations and energy spent or recovered. These counts are
        separate from passive abilities and do not claim extra baskets or
        points.
      </p>
      <ul className="mastery-roster">
        {rows.map((row) => {
          const stats = row.abilityActivations?.moves;
          return (
            <li key={row.key}>
              <strong>{row.label}</strong>
              {stats ? (
                <>
                  <p>
                    {basketballMoves
                      .filter((move) => (stats.uses[move.id] ?? 0) > 0)
                      .map((move) => `${move.name} ×${stats.uses[move.id]}`)
                      .join(" · ") || "No move activations"}
                  </p>
                  <small>
                    {stats.energySpent.toFixed(2)} energy spent ·{" "}
                    {stats.energyRecovered.toFixed(2)} recovered
                  </small>
                </>
              ) : (
                <p>No recorded move data</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
export function GameMovesReport({
  assignments,
}: {
  assignments?: Record<string, MoveAssignment>;
}) {
  if (!assignments) return null;
  return (
    <section className="mastery-panel" aria-label="Game move assignments">
      <h3>Coach-managed game moves</h3>
      <p>
        Frozen pregame assignments. Timing, costs and usage belong to this game;
        later training does not change them.
      </p>
      <details>
        <summary>View equipped moves and specializations</summary>
        <ul className="mastery-roster">
          {Object.entries(assignments).map(([playerId, plan]) => (
            <li key={playerId}>
              <strong>{playerName(Number(playerId.split(":")[1]))}</strong>
              <p>
                {specializationRules[plan.specialization].name} ·{" "}
                {plan.moves.map((move) => move.name).join(", ")}
              </p>
              <small>
                {specializationRules[plan.specialization].description}
              </small>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
