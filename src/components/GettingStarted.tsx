export interface ChecklistStep {
  label: string;
  detail: string;
  done: boolean;
  href?: string;
}

export function GettingStarted({
  steps,
  onHide,
}: {
  steps: ChecklistStep[];
  onHide: () => void;
}) {
  const next = steps.findIndex((step) => !step.done);
  return (
    <section
      className="getting-started"
      aria-labelledby="getting-started-title"
    >
      <div className="getting-started-heading">
        <h2 id="getting-started-title">
          <span className="eyebrow">GETTING STARTED</span>
          {steps.filter((step) => step.done).length} of {steps.length} done
        </h2>
        <button type="button" className="text-button" onClick={onHide}>
          Hide checklist
        </button>
      </div>
      <ol>
        {steps.map((step, i) => (
          <li
            key={step.label}
            className={step.done ? "done" : i === next ? "current" : ""}
            aria-current={i === next ? "step" : undefined}
          >
            <span className="step-marker" aria-hidden="true">
              {step.done ? "✓" : i + 1}
            </span>
            <span>
              <strong>
                {step.href && !step.done ? (
                  <a href={step.href}>{step.label}</a>
                ) : (
                  step.label
                )}
                <span className="sr-only">
                  {step.done ? " (done)" : " (to do)"}
                </span>
              </strong>
              <small>{step.detail}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
