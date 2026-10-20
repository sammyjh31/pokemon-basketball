import {
  COUNTER_LABELS,
  COUNTER_IDS,
  type CounterId,
} from "../game/counterTypes";
import {
  COUNTER_KEYS,
  counterDecision,
  type CounterDecision,
  type CounterResults,
} from "../game/counterLearning";
const EMPHASIS = {
  explore: "Test and learn",
  balanced: "Balanced use",
  emphasize: "Prioritize",
  reduce: "Use sparingly",
};
export function CounterLearningDecision({
  learning,
}: {
  learning: CounterDecision;
}) {
  return (
    <span>
      {" "}
      · {EMPHASIS[learning.emphasis]} ({learning.attacks.toFixed(1)} countered
      attacks; {learning.comparisonAttacks.toFixed(1)} comparison attacks)
    </span>
  );
}
export function CounterLearningResults({
  results,
  label,
}: {
  results: CounterResults;
  label: string;
}) {
  return (
    <details>
      <summary>{label}</summary>
      <p>
        Observed results are not proof a counter caused a stop or a basket.
        Lineups, timing and opponents differ. Coaches protect small samples,
        account for energy and keep testing alternatives.
      </p>
      <div
        className="results-table-wrap"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Response</th>
              <th>Coach emphasis</th>
              <th>With / without attacks</th>
              <th>Points per attack · with / without</th>
              <th>Scoreless / turnovers / fouls</th>
              <th>Energy / offensive answers</th>
            </tr>
          </thead>
          <tbody>
            {COUNTER_KEYS.flatMap((id) => {
              const row = results.counters[id];
              if (!row) return [];
              const d = counterDecision(results, id);
              return (
                <tr key={id}>
                  <th>
                    {COUNTER_LABELS[id]}
                    <small>
                      {COUNTER_IDS.includes(id as CounterId)
                        ? " · points allowed"
                        : " · points scored"}
                    </small>
                  </th>
                  <td>{EMPHASIS[d.emphasis]}</td>
                  <td>
                    {row.used.attacks.toFixed(1)} /{" "}
                    {row.without.attacks.toFixed(1)}
                  </td>
                  <td>
                    {row.used.attacks ? d.pointsPerAttack.toFixed(2) : "—"} /{" "}
                    {row.without.attacks
                      ? d.comparisonPointsPerAttack.toFixed(2)
                      : "—"}
                  </td>
                  <td>
                    {row.used.scoreless.toFixed(1)} /{" "}
                    {row.used.turnovers.toFixed(1)} /{" "}
                    {row.used.fouls.toFixed(1)}
                  </td>
                  <td>
                    {row.used.energy.toFixed(1)} /{" "}
                    {row.used.answered.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Supporting counts describe countered attacks. Carried samples fade
        between meetings and seasons. Final coach decisions also depend on
        mastery, chemistry, available defenders and fatigue.
      </p>
    </details>
  );
}
