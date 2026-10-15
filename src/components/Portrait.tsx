import { useState } from "react";
import type { Pokemon } from "../game/types";
export function Portrait({
  mon,
  className = "",
}: {
  mon: Pokemon;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span
      className={`portrait-fallback ${className}`}
      data-testid="portrait-fallback"
      aria-label={mon.name}
    >
      #{String(mon.id).padStart(3, "0")}
    </span>
  ) : (
    <img
      className={`portrait ${className}`}
      src={mon.spriteUrl}
      alt={mon.name}
      loading="lazy"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
export const TYPE_COLORS: Record<string, string> = {
  normal: "#8a8a77",
  fire: "#cf623b",
  water: "#477fae",
  electric: "#ae8619",
  grass: "#5c8b4d",
  ice: "#4a9698",
  fighting: "#ad664d",
  poison: "#9463a5",
  ground: "#a28254",
  flying: "#8179aa",
  psychic: "#be6187",
  bug: "#7b8947",
  rock: "#9c8851",
  ghost: "#766195",
  dragon: "#7563b3",
  dark: "#71605b",
  steel: "#70868f",
  fairy: "#b97597",
};
export function TypeBadges({ types }: { types: string[] }) {
  return (
    <div className="types">
      {types.map((type) => (
        <span key={type} style={{ color: TYPE_COLORS[type] }}>
          {type}
        </span>
      ))}
    </div>
  );
}
