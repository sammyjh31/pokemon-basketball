import {
  DRAFT_GENERATIONS,
  draftPokemon,
  draftPoolLabel,
  type DraftPool,
} from "../game/draftPool";
export function ChallengePoolPicker({
  pool,
  includeLegends,
  disabled,
  onChange,
}: {
  pool: DraftPool | undefined;
  includeLegends: boolean;
  disabled: boolean;
  onChange: (pool: DraftPool) => void;
}) {
  const count = draftPokemon(pool).filter(
    (p) => includeLegends || !p.legendary,
  ).length;
  return (
    <section className="challenge-pool" aria-label="Challenge Pokémon pool">
      <label>
        Draft pool
        <select
          aria-label="Challenge generation"
          value={pool ?? "legacy"}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              e.target.value === "all"
                ? "all"
                : (Number(e.target.value) as DraftPool),
            )
          }
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
          : "Your offers and re-rolls use this pool. CPU teams draft from all seven generations, with unique rosters."}
      </p>
    </section>
  );
}
