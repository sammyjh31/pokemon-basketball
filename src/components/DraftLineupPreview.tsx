import { POKEMON_BY_ID } from "../data/pokemon";
import { ROSTER_SLOTS, type Roster, type RosterSlot } from "../game/types";

export function DraftLineupPreview({
  current,
  proposed,
  pokemonId,
  lockedSlots = [],
}: {
  current: Roster;
  proposed: Roster;
  pokemonId?: number;
  lockedSlots?: readonly RosterSlot[];
}) {
  return (
    <div className="draft-lineup-preview">
      <ul aria-label={pokemonId ? "Proposed lineup" : "Baseline lineup"}>
        {ROSTER_SLOTS.filter((s) => proposed[s] !== null).map((slot) => {
          const id = proposed[slot]!;
          const from = ROSTER_SLOTS.find((s) => current[s] === id);
          return (
            <li key={slot}>
              <b>{slot}</b>
              <span>
                {POKEMON_BY_ID.get(id)!.name}
                <small>
                  {id === pokemonId
                    ? "New pick"
                    : lockedSlots.includes(slot)
                      ? `Locked at ${slot}`
                      : from === slot
                        ? "Stays"
                        : `${from} → ${slot}`}
                </small>
              </span>
            </li>
          );
        })}
      </ul>
      {!Object.values(proposed).some((id) => id !== null) && (
        <p>No players yet.</p>
      )}
    </div>
  );
}
