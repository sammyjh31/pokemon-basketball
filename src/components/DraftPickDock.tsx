import { useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "../game/playerProfile";
import {
  ROSTER_SLOTS,
  SLOT_NAMES,
  type Position,
  type RosterSlot,
  type Run,
} from "../game/types";
import { Portrait, TypeBadges } from "./Portrait";
import { useShinyPokemon, ShinyBadge } from "./ShinyPokemon";

export function DraftPickDock({
  run,
  pokemonId,
  onPlace,
  onCancel,
  disabled = false,
}: {
  run: Run;
  pokemonId: number;
  onPlace: (slot: RosterSlot) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const mon = useShinyPokemon(POKEMON_BY_ID.get(pokemonId)!);
  const profile = playerProfile(mon);
  const slots = ROSTER_SLOTS.filter(
    (slot) => run.mode === "free" || run.roster[slot] === null,
  );
  const open = slots.filter((slot) => run.roster[slot] === null);
  const starters = open.filter((slot) => !slot.startsWith("B"));
  const fit = (slot: RosterSlot) =>
    profile.positions[
      slot.startsWith("B") ? profile.bestPosition : (slot as Position)
    ];
  const preferred = [
    ...(starters.length ? starters : open.length ? open : slots),
  ].sort((a, b) => fit(b) - fit(a))[0];
  const [chosen, setChosen] = useState<RosterSlot | undefined>(preferred);
  const slot = chosen && slots.includes(chosen) ? chosen : preferred;
  const replacement = slot
    ? POKEMON_BY_ID.get(run.roster[slot] ?? -1)
    : undefined;
  return (
    <section
      className="draft-pick-dock"
      aria-label="Current draft pick"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !disabled) {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="pick-dock-identity">
        <Portrait mon={mon} />
        <div>
          <span className="pick-dock-eyebrow">ON YOUR DRAFT BOARD</span>
          <h2>{mon.name}</h2>
          <p>{profile.archetype}</p>
          <TypeBadges types={mon.types} />
          <ShinyBadge mon={mon} />
        </div>
      </div>
      <div className="pick-dock-fit">
        <strong>{slot ? Math.round(fit(slot)) : "—"}</strong>
        <span>
          POSITION FIT<small>out of 100</small>
        </span>
      </div>
      <div className="pick-dock-actions">
        <label>
          Pick position
          <select
            value={slot ?? ""}
            disabled={disabled || !slot}
            onChange={(event) => setChosen(event.target.value as RosterSlot)}
          >
            {slots.map((position) => (
              <option key={position} value={position}>
                {position} ·{" "}
                {run.roster[position]
                  ? `Replace ${POKEMON_BY_ID.get(run.roster[position]!)?.name}`
                  : SLOT_NAMES[position]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button primary"
          disabled={disabled || !slot}
          onClick={() => slot && onPlace(slot)}
        >
          {replacement
            ? `Replace ${replacement.name} at ${slot}`
            : `Place at ${slot ?? "—"}`}
          <span aria-hidden="true"> →</span>
        </button>
      </div>
      <button
        className="pick-dock-cancel"
        aria-label="Cancel selection"
        disabled={disabled}
        onClick={onCancel}
      >
        ×
      </button>
    </section>
  );
}
