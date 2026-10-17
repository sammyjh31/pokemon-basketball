interface Factor {
  label: string;
  contribution: number;
  detail: string;
}
/** The model supplies the arithmetic; presentation never invents another score. */
export function EvaluationFactors({
  factors,
}: {
  factors?: readonly Factor[];
}) {
  if (!factors?.length) return null;
  return (
    <details className="trade-factors">
      <summary>Shared team value breakdown</summary>
      <ul>
        {factors.map((factor, i) => (
          <li key={i}>
            <strong>
              {factor.label}{" "}
              <span>
                {factor.contribution >= 0 ? "+" : ""}
                {factor.contribution.toFixed(2)}
              </span>
            </strong>
            <p>{factor.detail}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
