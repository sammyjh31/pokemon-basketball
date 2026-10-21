import { POKEMON_BY_ID } from "../data/pokemon";
import { ROSTER_SLOTS, type Roster, type RosterSlot } from "../game/types";
import { Portrait } from "./Portrait";

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
            <li
              key={slot}
              className={
                id === pokemonId
                  ? "is-new-pick"
                  : lockedSlots.includes(slot)
                    ? "is-locked"
                    : ""
              }
            >
              <b>{slot}</b>
              <Portrait key={id} mon={POKEMON_BY_ID.get(id)!} />
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
