import { useMemo } from "react";
import {
  draftComparisonMetrics,
  draftImpactLeaders,
  projectDraftImpact,
  type DraftImpactFocus,
} from "../game/draftImpact";
import {
  ROSTER_SLOTS,
  SLOT_NAMES,
  type Pokemon,
  type Roster,
  type RosterSlot,
  type RotationStyle,
  type Tactic,
} from "../game/types";
import { Portrait } from "./Portrait";
import { draftImpactChangeLabel as changeLabel } from "./draftImpactFormat";

export function DraftImpactComparison({
  mons,
  roster,
  tactic,
  rotation,
  slot,
  focus,
  onSlot,
  onFocus,
  onReview,
}: {
  mons: Pokemon[];
  roster: Roster;
  tactic: Tactic;
  rotation: RotationStyle;
  slot: RosterSlot;
  focus: DraftImpactFocus;
  onSlot: (slot: RosterSlot) => void;
  onFocus: (focus: DraftImpactFocus) => void;
  onReview: (id: number, slot: RosterSlot) => void;
}) {
  const vacancies = ROSTER_SLOTS.filter((slot) => roster[slot] === null);
  const prospects = useMemo(
    () =>
      mons.flatMap((mon) => {
        const impact = projectDraftImpact(
          roster,
          mon.id,
          slot,
          tactic,
          rotation,
        );
        return impact
          ? [
              {
                mon,
                pokemonId: mon.id,
                impact,
                metrics: draftComparisonMetrics(impact),
              },
            ]
          : [];
      }),
    [mons, roster, slot, tactic, rotation],
  );
  if (prospects.length < 2) return null;
  const rows = prospects[0].metrics;
  const leaders = draftImpactLeaders(prospects, focus);
  const leaderNames = prospects
    .filter((p) => leaders.includes(p.pokemonId))
    .map((p) => p.mon.name)
    .join(" & ");
  const leadingMetric = prospects
    .find((p) => leaders.includes(p.pokemonId))!
    .metrics.find((m) => m.key === focus)!;
  const currentCount = prospects[0].impact.beforeCount;
  return (
    <section
      className="draft-comparison draft-impact-comparison"
      aria-label="Compare team impact"
    >
      <h4>Who helps your team most?</h4>
      <p>
        Each option adds one player to the same roster · {currentCount} drafted
        players · same coaching and rotation.
      </p>
      <div className="draft-impact-compare-controls">
        <label>
          Preview draft position
          <select
            value={slot}
            onChange={(e) => onSlot(e.target.value as RosterSlot)}
          >
            {vacancies.map((s) => (
              <option key={s} value={s}>
                {s} · {SLOT_NAMES[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioritize
          <select
            value={focus}
            onChange={(e) => onFocus(e.target.value as DraftImpactFocus)}
          >
            {rows.map((metric) => (
              <option key={metric.key} value={metric.key}>
                {metric.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="draft-impact-leader" role="status">
        <span className="eyebrow">
          {leaders.length > 1 ? "JOINT LEADERS" : "SHORTLIST LEADER"} · {slot}
        </span>
        <strong>{leaderNames}</strong>
        <p>
          {leadingMetric.label}: {leadingMetric.after.toFixed(1)} projected
          {leadingMetric.delta !== null
            ? ` (${changeLabel(leadingMetric.delta)} vs now)`
            : " · starting profile"}
          .
          {leadingMetric.delta !== null && leadingMetric.delta <= 0
            ? " Highest among these options; this team average does not rise."
            : ""}
        </p>
      </div>
      <p className="draft-compare-hint">
        Swipe or scroll sideways to see every player.
      </p>
      <div
        className="draft-comparison-scroll"
        role="region"
        aria-label="Scrollable team impact comparison"
        tabIndex={0}
      >
        <table aria-label="Team impact by candidate">
          <thead>
            <tr>
              <th scope="col">Team area</th>
              <th scope="col" className="draft-impact-now">
                Now
              </th>
              {prospects.map(({ mon }) => (
                <th scope="col" key={mon.id}>
                  <Portrait mon={mon} />
                  <strong>{mon.name}</strong>
                  <small>
                    With {mon.name} at {slot}
                  </small>
                  <button
                    className="text-button"
                    onClick={() => onReview(mon.id, slot)}
                  >
                    Review {mon.name} pick
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowLeaders = draftImpactLeaders(prospects, row.key);
              return (
                <tr
                  key={row.key}
                  className={row.key === focus ? "is-prioritized" : ""}
                >
                  <th scope="row">
                    {row.label}
                    {row.key === "balance" && (
                      <small>Equal average of offense and defense</small>
                    )}
                  </th>
                  <td className="draft-impact-now">
                    {row.before?.toFixed(1) ?? "—"}
                  </td>
                  {prospects.map((prospect) => {
                    const metric = prospect.metrics.find(
                      (m) => m.key === row.key,
                    )!;
                    const leading = rowLeaders.includes(prospect.pokemonId);
                    return (
                      <td key={prospect.pokemonId}>
                        <span
                          className={`draft-compare-number ${leading ? "is-leading" : ""}`}
                        >
                          {metric.after.toFixed(1)}
                        </span>
                        <span
                          className={`draft-impact-delta ${(metric.delta ?? 0) > 0 ? "gain" : (metric.delta ?? 0) < 0 ? "loss" : ""}`}
                        >
                          {changeLabel(metric.delta)}
                          {metric.delta !== null && " vs now"}
                        </span>
                        {leading && (
                          <small className="draft-impact-best">
                            {rowLeaders.length > 1 ? "Tied best" : "Best"}
                          </small>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <th scope="row">Biggest lift / tradeoff</th>
              <td className="draft-impact-now">—</td>
              {prospects.map(({ mon, impact }) => {
                const ordered = [...impact.metrics].sort(
                  (a, b) => (b.delta ?? 0) - (a.delta ?? 0),
                );
                const gain = ordered[0],
                  loss = ordered.at(-1)!;
                return (
                  <td key={mon.id} className="draft-impact-tradeoffs">
                    {!currentCount ? (
                      <small>Sets your team's starting profile.</small>
                    ) : (
                      <>
                        <span>
                          {(gain.delta ?? 0) > 0
                            ? `${gain.label} ${changeLabel(gain.delta)}`
                            : "No team average rises."}
                        </span>
                        <small>
                          {(loss.delta ?? 0) < 0
                            ? `${loss.label} ${changeLabel(loss.delta)}`
                            : "No team average drops."}
                        </small>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <details className="draft-impact-method">
        <summary>How the comparison is ranked</summary>
        <p>
          Balanced offense + defense weights those two ratings equally. Choose
          another priority to rank by that area alone. Gold marks the highest
          projected rating in each row; ties use the displayed one-decimal
          ratings. This compares your shortlist, not the full draft pool.
        </p>
        <p>
          Ratings use your drafted roster, position, coaching and expected
          minutes. Empty slots are excluded; a specialist can fill a need while
          lowering an average. First picks establish a profile without a zero
          baseline. These are roster estimates, not predicted wins or a
          simulation of opponent matchups and in-game effects.
        </p>
      </details>
    </section>
  );
}
