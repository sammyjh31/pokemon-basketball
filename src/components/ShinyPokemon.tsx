import { createContext, useContext } from "react";
import { shinyPokemon, SHINY_ODDS, SHINY_SKILL_BONUS } from "../game/shiny";
import type { Pokemon } from "../game/types";

export const ShinyContext = createContext<number | undefined>(undefined);
export const useShinyPokemon = (mon: Pokemon): Pokemon =>
  shinyPokemon(mon, useContext(ShinyContext));
export function ShinyBadge({ mon }: { mon: Pokemon }) {
  const variant = useShinyPokemon(mon);
  return variant.shiny ? (
    <span
      className="shiny-badge"
      title="Rare shiny — +3 to basketball skills, capped at 100"
    >
      SHINY +3
    </span>
  ) : null;
}
export function ShinyRules({ seed }: { seed?: number }) {
  return seed === undefined ? null : (
    <p className="shiny-rules">
      Rare shinies · 1 in {SHINY_ODDS.toLocaleString("en-US")} per Pokémon · +
      {SHINY_SKILL_BONUS} to skills, capped at 100. Variants stay fixed for this
      league.
    </p>
  );
}
