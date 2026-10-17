import { POKEMON_BY_ID } from "../data/pokemon";
import { speciesAbility } from "../game/abilities";
import { TACTIC_LABELS } from "../game/types";
import "../speciesAbilities.css";

export function SpeciesAbility({ pokemonId }: { pokemonId: number }) {
  const ability = speciesAbility(pokemonId);
  return (
    <section
      className="species-ability"
      aria-label={`${POKEMON_BY_ID.get(pokemonId)?.name ?? `#${pokemonId}`} species ability`}
    >
      <span className="eyebrow">SPECIES ABILITY · BASKETBALL ADAPTATION</span>
      <strong>{ability.name}</strong>
      <p>{ability.description}</p>
      <small>
        Fits{" "}
        {ability.tactics.map((tactic) => TACTIC_LABELS[tactic]).join(" / ")}.
        Applies in games using species ability rules; older saves retain their
        original rules.
      </small>
    </section>
  );
}
