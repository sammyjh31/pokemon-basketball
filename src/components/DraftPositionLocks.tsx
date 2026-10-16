import { POKEMON_BY_ID } from "../data/pokemon";
import { ROSTER_SLOTS, type Roster, type RosterSlot } from "../game/types";

export function DraftPositionLocks({
  roster,
  lockedSlots,
  onChange,
}: {
  roster: Roster;
  lockedSlots: readonly RosterSlot[];
  onChange?: (slots: RosterSlot[]) => void;
}) {
  const filled = ROSTER_SLOTS.filter((slot) => roster[slot] !== null);
  return (
    <section className="draft-position-locks" aria-label="Position locks">
      <div className="draft-position-locks-heading">
        <h4>Keep players in place</h4>
        {!!lockedSlots.length && (
          <button
            className="text-button"
            disabled={!onChange}
            onClick={() => onChange?.([])}
          >
            Unlock all
          </button>
        )}
      </div>
      <p>
        {filled.length
          ? "Lock a Pokémon to keep its current position in every lineup search. Locks save for your team's next turns."
          : "After drafting a Pokémon, you can lock its position here."}
      </p>
      <div className="draft-position-lock-buttons">
        {filled.map((slot) => {
          const name = POKEMON_BY_ID.get(roster[slot]!)!.name;
          const locked = lockedSlots.includes(slot);
          return (
            <button
              key={slot}
              aria-label={`${locked ? "Unlock" : "Lock"} ${name} at ${slot}`}
              aria-pressed={locked}
              disabled={!onChange}
              onClick={() =>
                onChange?.(
                  locked
                    ? lockedSlots.filter((s) => s !== slot)
                    : [...lockedSlots, slot],
                )
              }
            >
              <span>
                <b>{slot}</b> {name}
              </span>
              <small>{locked ? "Locked" : "Lock"}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
