import { useId } from "react";
import { playerProfile } from "../game/playerProfile";
import { useShinyPokemon, ShinyBadge } from "./ShinyPokemon";
import { attributes, positionRating } from "../game/ratings";
import { POSITIONS, type Pokemon } from "../game/types";
import { Portrait, TypeBadges, TYPE_COLORS } from "./Portrait";
export function PokemonCard({
  mon,
  selected,
  onSelect,
}: {
  mon: Pokemon;
  selected: boolean;
  onSelect: () => void;
}) {
  mon = useShinyPokemon(mon);
  const descriptionId = useId();
  const a = attributes(mon),
    best = [...POSITIONS].sort(
      (x, y) => positionRating(mon, y) - positionRating(mon, x),
    )[0];
  return (
    <button
      className={`pokemon-card ${selected ? "selected" : ""}`}
      style={
        { "--type-color": TYPE_COLORS[mon.types[0]] } as React.CSSProperties
      }
      aria-label={`Draft ${mon.name}`}
      aria-pressed={selected}
      aria-describedby={descriptionId}
      onClick={onSelect}
    >
      <span className="card-top">
        <span>#{String(mon.id).padStart(3, "0")}</span>
        <span className="best-position">
          {best} <b>{Math.round(positionRating(mon, best))}</b>
        </span>
      </span>
      <div className="portrait-stage">
        <Portrait key={mon.id} mon={mon} />
        <span className="portrait-orbit" />
      </div>
      <div className="card-name">
        {mon.name}
        {mon.legendary && (
          <span className="legend-star" aria-label="Legendary or mythical">
            ✦
          </span>
        )}
      </div>
      <span className="card-archetype">{playerProfile(mon).archetype}</span>
      <ShinyBadge mon={mon} />
      <TypeBadges types={mon.types} />
      <div className="card-stats" id={descriptionId}>
        {[
          ["SHOOT", a.shooting],
          ["FINISH", a.finishing],
          ["DEFEND", (a.perimeterDefense + a.interiorDefense) / 2],
        ].map(([label, value]) => (
          <span key={label} className="card-skill">
            <span>
              {label}
              <b>{Math.round(Number(value))}</b>
            </span>
            <i aria-hidden="true">
              <i style={{ width: `${value}%` }} />
            </i>
          </span>
        ))}
      </div>
      <span className="card-select">
        {selected ? "SELECTED" : "SELECT POKÉMON"}
        <span aria-hidden="true">{selected ? "✓" : "↗"}</span>
      </span>
    </button>
  );
}
