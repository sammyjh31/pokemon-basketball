import { useShinyPokemon } from "./ShinyPokemon";
import { publicAsset } from "../assets";
import { useContext, useState } from "react";
import { SpriteContext } from "./SpriteControls";
import type { Pokemon } from "../game/types";
export function Portrait({
  mon,
  className = "",
}: {
  mon: Pokemon;
  className?: string;
}) {
  mon = useShinyPokemon(mon);
  const style = useContext(SpriteContext);
  const src = publicAsset(
    mon.shiny
      ? `/pokemon-shiny/${mon.id}.png`
      : style === "pixel"
        ? `/pokemon-pixel/${mon.id}.png`
        : mon.spriteUrl,
  );
  const [failed, setFailed] = useState<string | null>(null);
  return failed === src ? (
    <span
      className={`portrait-fallback ${className}`}
      data-testid="portrait-fallback"
      aria-label={mon.name}
    >
      #{String(mon.id).padStart(3, "0")}
    </span>
  ) : (
    <img
      className={`portrait ${style}${mon.shiny ? " is-shiny" : ""} ${className}`}
      src={src}
      alt={mon.shiny ? `Shiny ${mon.name}` : mon.name}
      title={mon.shiny ? `Shiny ${mon.name} · +3 skills` : undefined}
      loading="lazy"
      onError={() => setFailed(src)}
      draggable={false}
    />
  );
}
export const TYPE_COLORS: Record<string, string> = {
  normal: "#c4c4a5",
  fire: "#ffad7b",
  water: "#91c5f7",
  electric: "#f2d45c",
  grass: "#acd58d",
  ice: "#91d9d8",
  fighting: "#efa591",
  poison: "#d5a6eb",
  ground: "#d9bd91",
  flying: "#bdb4f3",
  psychic: "#f1a0cb",
  bug: "#c3d48c",
  rock: "#d3c28f",
  ghost: "#b9a1dd",
  dragon: "#bea6ff",
  dark: "#c2b4af",
  steel: "#adc6d0",
  fairy: "#e9afd2",
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
