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
      <ShinyBadge mon={mon} />
      <TypeBadges types={mon.types} />
      <div className="card-stats">
        <span>
          SHO <b>{Math.round(a.shooting)}</b>
        </span>
        <span>
          FIN <b>{Math.round(a.finishing)}</b>
        </span>
        <span>
          DEF <b>{Math.round((a.perimeterDefense + a.interiorDefense) / 2)}</b>
        </span>
      </div>
      <span className="card-select">
        {selected ? "SELECTED" : "SELECT POKÉMON"}
        <span aria-hidden="true">{selected ? "✓" : "↗"}</span>
      </span>
    </button>
  );
}
