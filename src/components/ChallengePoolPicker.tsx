import {
  DRAFT_GENERATIONS,
  draftPokemon,
  draftPoolLabel,
  isDraftPool,
  type DraftPool,
} from "../game/draftPool";
import type { Mode } from "../game/types";
export function ChallengePoolPicker({
  mode = "spin",
  pool,
  includeLegends,
  disabled,
  onChange,
}: {
  mode?: Mode;
  pool: DraftPool | undefined;
  includeLegends: boolean;
  disabled: boolean;
  onChange: (pool: DraftPool) => void;
}) {
  const count = draftPokemon(pool).filter(
    (p) => includeLegends || !p.legendary,
  ).length;
  return (
    <section
      className="challenge-pool"
      aria-label={`${mode === "free" ? "Lineup" : "Challenge"} Pokémon pool`}
    >
      <label>
        Draft pool
        <select
          aria-label={`${mode === "free" ? "Lineup" : "Challenge"} generation`}
          value={pool ?? "legacy"}
          disabled={disabled}
          onChange={(e) => {
            const next =
              e.target.value === "all" ? "all" : Number(e.target.value);
            if (isDraftPool(next)) onChange(next);
          }}
        >
          {pool === undefined && (
            <option value="legacy">Generations I–II (saved pool)</option>
          )}
          <option value="all">All seven generations · 809 Pokémon</option>
          {DRAFT_GENERATIONS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <p>
        {draftPoolLabel(pool)} · {count} eligible Pokémon.{" "}
        {pool === undefined
          ? "This saved draft keeps its original player pool."
          : mode === "free"
            ? "Search, randomize and auto-fill bench use this pool. CPU teams draft from all seven generations, with unique rosters."
            : "Your offers and re-rolls use this pool. CPU teams draft from all seven generations, with unique rosters."}
      </p>
    </section>
  );
}
