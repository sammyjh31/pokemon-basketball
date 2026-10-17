import {
  abilityTotal,
  speciesAbility,
  type AbilityActivations,
} from "../game/abilities";
import "../speciesAbilities.css";

export interface AbilityStatsRow {
  key: string | number;
  label: string;
  pokemonId?: number;
  abilityActivations?: AbilityActivations;
}

export function AbilityStats({
  label,
  rows,
}: {
  label: string;
  rows: AbilityStatsRow[];
}) {
  if (!rows.length) return null;
  return (
    <section className="ability-stats" aria-label={label}>
      <h4>Species ability activations</h4>
      <p className="stat-legend">
        Counts record applied effects, including misses; they do not measure
        baskets made or points caused. Offense = shooter, support = passer,
        defense = primary defender. Totals remain counts and include recorded
        games only. Unavailable means no recorded ability data, including legacy
        games and disabled rules.
      </p>
      <p className="ability-scroll-hint">
        Scroll across for the activation breakdown.
      </p>
      <div
        className="results-table-wrap ability-stats-scroll"
        role="region"
        tabIndex={0}
        aria-label={`Scrollable ${label.toLowerCase()}`}
      >
        <table className="results-table ability-stats-table">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr>
              <th scope="col">PLAYER / SEASON</th>
              <th scope="col">TOTAL</th>
              <th scope="col">SPECIES ABILITY</th>
              <th scope="col">OFFENSE</th>
              <th scope="col">SUPPORT</th>
              <th scope="col">DEFENSE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ability =
                row.pokemonId === undefined
                  ? undefined
                  : speciesAbility(row.pokemonId);
              return (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td
                    className={
                      row.abilityActivations ? undefined : "ability-unavailable"
                    }
                  >
                    {row.abilityActivations
                      ? abilityTotal(row).toLocaleString("en-US")
                      : "Unavailable"}
                  </td>
                  <td>
                    {ability ? (
                      <span title={ability.description}>{ability.name}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  {row.abilityActivations ? (
                    <>
                      <td>
                        {row.abilityActivations.offense.toLocaleString("en-US")}
                      </td>
                      <td>
                        {row.abilityActivations.support.toLocaleString("en-US")}
                      </td>
                      <td>
                        {row.abilityActivations.defense.toLocaleString("en-US")}
                      </td>
                    </>
                  ) : (
                    <td colSpan={3} className="ability-unavailable">
                      No recorded ability data
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
