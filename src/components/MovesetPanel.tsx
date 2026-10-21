import {
  COUNTER_LABELS,
  type CounterId,
  type CounterComboId,
} from "../game/counterTypes";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  allBasketballMoves,
  isMovesetVersion,
  movesEnabled,
  movePool,
} from "../game/basketballMoves";
import { coachCombos, combosEnabled } from "../game/comboPolicy";
import { comboPlays, type ComboAssignment } from "../game/comboTypes";
import type { CourtSequence } from "../game/courtTypes";
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
  if (!isMovesetVersion(team.movesetVersion)) return null;
  return (
    <section className="mastery-panel" aria-label="Basketball movesets">
      <h3>Basketball movesets</h3>
      <p>
        Your coach manages move selection, training and in-game timing
        automatically. Moves are basketball adaptations, with energy costs and
        cooldowns. Earned mastery follows Pokémon through trades and seasons.
      </p>
      {(team.movesetVersion ?? 0) >= 3 && (
        <p>
          Coaches automatically counter repeated moves and combos using observed
          evidence. Defensive responses and offensive counter-combos cost energy
          and depend on mastery, chemistry and available players. Counter
          scouting is disabled when adaptive coaching or abilities are off.
        </p>
      )}
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
                {(team.movesetVersion ?? 0) >= 2 && (
                  <details>
                    <summary>Signature moves and unlocks</summary>
                    <p>
                      Type techniques unlock at 25 XP; species signatures at 100
                      XP. Eligibility does not guarantee an equipped slot: your
                      coach chooses the best fit.
                    </p>
                    <ul>
                      {movePool(id, 2, team.shinySeed)
                        .filter((m) => m.signature)
                        .map((move) => (
                          <li key={move.id}>
                            <strong>{move.name}</strong> —{" "}
                            {plan.xp < move.signature!.minimumMastery
                              ? `locked until ${move.signature!.minimumMastery} XP`
                              : plan.moves.some((m) => m.id === move.id)
                                ? "equipped"
                                : "unlocked; available to coach"}
                            . {move.description}
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
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
      {(team.movesetVersion ?? 0) >= 2 && movesEnabled(team) && (
        <details>
          <summary>Coach combo playbook</summary>
          <p>
            Partners need 25 each in mastery XP. Coaches consider earned pair
            familiarity, active-lineup chemistry, energy and recovery time.
            Setups cost each partner energy and share a 100-second player
            cooldown; a created shot is not a made basket.
          </p>
          {combosEnabled(team) ? (
            <ComboPlans
              plans={coachCombos(team, true).filter(
                (p) =>
                  pokemonId === undefined ||
                  p.initiatorId === pokemonId ||
                  p.partnerId === pokemonId,
              )}
            />
          ) : (
            <p>Team chemistry is disabled, so combo plays are unavailable.</p>
          )}
        </details>
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
                    {allBasketballMoves
                      .filter((move) => (stats.uses[move.id] ?? 0) > 0)
                      .map((move) => `${move.name} ×${stats.uses[move.id]}`)
                      .join(" · ") || "No move activations"}
                  </p>
                  {stats.combos && (
                    <ul>
                      {comboPlays
                        .filter((p) => (stats.combos!.attempts[p.id] ?? 0) > 0)
                        .map((play) => (
                          <li key={play.id}>
                            {play.name}: {stats.combos!.attempts[play.id]}{" "}
                            setups · {stats.combos!.shotsCreated[play.id] ?? 0}{" "}
                            shots created
                          </li>
                        ))}
                    </ul>
                  )}
                  {stats.combos && (
                    <p>
                      Participant counts; each partner receives credit. Shots
                      created are attempts, not made baskets. Energy includes
                      combo setup costs.
                    </p>
                  )}
                  {stats.counters && (
                    <p>
                      {Object.entries(stats.counters.responses)
                        .map(
                          ([id, n]) =>
                            `${COUNTER_LABELS[id as CounterId]} ×${n}`,
                        )
                        .concat(
                          Object.entries(stats.counters.counterCombos).map(
                            ([id, n]) =>
                              `${COUNTER_LABELS[id as CounterComboId]} ×${n}`,
                          ),
                        )
                        .join(" · ")}{" "}
                      · Participant activations, not guaranteed stops or
                      baskets. Energy includes counter costs.
                    </p>
                  )}
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

function ComboPlans({ plans }: { plans: ComboAssignment[] }) {
  if (!plans.length) return <p>No current pair assignments for this player.</p>;
  return (
    <ul className="mastery-roster">
      {plans.map((p) => (
        <li key={`${p.id}:${p.initiatorId}:${p.partnerId}`}>
          <strong>
            {comboPlays.find((c) => c.id === p.id)!.name}:{" "}
            {playerName(p.initiatorId)} → {playerName(p.partnerId)}
          </strong>
          <p>
            {p.unlocked
              ? "Available to coach"
              : "Locked: partners need 25 XP each"}{" "}
            · pair mastery {p.mastery.toFixed(1)} XP · chemistry{" "}
            {p.chemistry.toFixed(0)}/100 · earned familiarity{" "}
            {(p.familiarity * 100).toFixed(0)}%
          </p>
          {p.reasons.map((reason, i) => (
            <small key={i}>{reason} </small>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function GameComboReport({
  assignments,
  sequences = [],
  teams = [],
}: {
  assignments?: Record<number, ComboAssignment[]>;
  sequences?: CourtSequence[];
  teams?: LeagueTeam[];
}) {
  if (!assignments) return null;
  const events = sequences.flatMap((s) => s.combos ?? []);
  return (
    <section className="mastery-panel" aria-label="Game combo plays">
      <h3>Coach combo plays</h3>
      <p>
        Frozen pregame partnerships. Actual setups and shots created are
        separate from made baskets; later trades or training do not change these
        plans.
      </p>
      <p>
        {events.length
          ? `${events.filter((e) => e.stage === "setup").length} setups · ${events.filter((e) => e.stage === "shot").length} shots created (one count per pair).`
          : "No recorded combo actions in this game."}
      </p>
      <details>
        <summary>View planned partnerships and actual timing</summary>
        {Object.entries(assignments).map(([id, plans]) => (
          <div key={id}>
            <h4>
              {teams.find((t) => t.id === Number(id))?.name ??
                `Team ${Number(id) + 1}`}
            </h4>
            <ComboPlans plans={plans} />
          </div>
        ))}
        {events.length > 0 && (
          <ul>
            {events.map((e, i) => (
              <li key={i}>
                {Math.floor(e.elapsedSeconds / 60)}:
                {String(Math.floor(e.elapsedSeconds % 60)).padStart(2, "0")}{" "}
                elapsed · {comboPlays.find((p) => p.id === e.id)!.name} ·{" "}
                {e.playerIds
                  .map((id) => playerName(Number(id.split(":")[1])))
                  .join(" → ")}{" "}
                · {e.stage === "setup" ? "setup" : "shot created"} · pair
                mastery {e.mastery.toFixed(1)} XP · lineup chemistry{" "}
                {e.lineupChemistry.toFixed(0)}/100
              </li>
            ))}
          </ul>
        )}
      </details>
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
