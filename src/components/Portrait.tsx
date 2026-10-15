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
  normal: "#6b6b5c",
  fire: "#a14c2e",
  water: "#376387",
  electric: "#876813",
  grass: "#476c3c",
  ice: "#397576",
  fighting: "#864f3c",
  poison: "#734d80",
  ground: "#7e6541",
  flying: "#645e84",
  psychic: "#944b69",
  bug: "#5f6a37",
  rock: "#796a3f",
  ghost: "#5c4b74",
  dragon: "#5b4d8b",
  dark: "#584a46",
  steel: "#57686f",
  fairy: "#905b75",
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
