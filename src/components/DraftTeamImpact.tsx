import type { DraftImpact } from "../game/draftImpact";
import type { RosterSlot } from "../game/types";

const changeLabel = (value: number | null) =>
  value === null
    ? "—"
    : value > 0
      ? `+${value.toFixed(1)}`
      : value < 0
        ? `−${Math.abs(value).toFixed(1)}`
        : "0.0";

export function DraftTeamImpact({
  impact,
  name,
  slot,
  optimized = false,
}: {
  impact: DraftImpact;
  name: string;
  slot: RosterSlot;
  optimized?: boolean;
}) {
  const strengths = impact.metrics
    .filter((metric) => metric.tool)
    .sort((a, b) => b.after - a.after);
  const gains = impact.metrics
    .filter((metric) => (metric.delta ?? 0) > 0)
    .sort((a, b) => b.delta! - a.delta!);
  const drops = impact.metrics
    .filter((metric) => (metric.delta ?? 0) < 0)
    .sort((a, b) => a.delta! - b.delta!);
  return (
    <section className="draft-team-impact" aria-label="Team impact preview">
      <h4>What changes for your team</h4>
      <p className="draft-impact-context">
        With {name} at {slot} · {impact.beforeCount} → {impact.afterCount}{" "}
        players
      </p>
      {optimized && (
        <p>
          Changes are measured against your current roster after lineup search,
          using the same priority.
        </p>
      )}
      <div className="draft-impact-summary" aria-live="polite">
        {!impact.beforeCount ? (
          <p>First pick: this sets your team's starting profile.</p>
        ) : (
          <>
            <p>
              <b>Biggest lift:</b>{" "}
              {gains.length
                ? `${gains[0].label} (${changeLabel(gains[0].delta)}).`
                : "Adds depth; no team rating rises."}
            </p>
            {drops.length > 0 && (
              <p>
                <b>Tradeoff:</b> {drops[0].label} ({changeLabel(drops[0].delta)}
                ).
              </p>
            )}
          </>
        )}
      </div>
      <table aria-label="Team ratings before and after this pick">
        <thead>
          <tr>
            <th scope="col">Team area</th>
            <th scope="col">{optimized ? "Rearranged baseline" : "Now"}</th>
            <th scope="col">After</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {impact.metrics.map((metric) => (
            <tr key={metric.key}>
              <th scope="row">
                {metric.label}
                <span className="draft-impact-track" aria-hidden="true">
                  {metric.before !== null && (
                    <i
                      className="before"
                      style={{ width: `${metric.before}%` }}
                    />
                  )}
                  <i className="after" style={{ width: `${metric.after}%` }} />
                </span>
              </th>
              <td>{metric.before?.toFixed(1) ?? "—"}</td>
              <td>{metric.after.toFixed(1)}</td>
              <td
                className={
                  (metric.delta ?? 0) > 0
                    ? "gain"
                    : (metric.delta ?? 0) < 0
                      ? "loss"
                      : ""
                }
              >
                {changeLabel(metric.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="draft-impact-legend">
        Gray: now · Blue: after · Ratings out of 100
      </p>
      <dl className="draft-impact-outlook">
        <div>
          <dt>Strongest areas after pick</dt>
          <dd>
            {strengths
              .slice(0, 2)
              .map((metric) => metric.label)
              .join(" · ")}
          </dd>
        </div>
        <div>
          <dt>Lowest-rated areas after pick</dt>
          <dd>
            {strengths
              .slice(-2)
              .reverse()
              .map((metric) => metric.label)
              .join(" · ")}
          </dd>
        </div>
      </dl>
      <details className="draft-impact-method">
        <summary>How this preview works</summary>
        <p>
          Uses your drafted players, chosen position, coaching and expected
          rotation minutes. Empty slots are excluded. Adding a specialist can
          lower an average while filling a need. Strongest and lowest areas are
          relative to this roster, not league rankings. These are roster
          ratings, not predicted wins; opponent matchups and in-game effects are
          not simulated here.
        </p>
      </details>
    </section>
  );
}
