import { useMemo } from "react";
import {
  bestDraftImpacts,
  draftImpactLeaders,
  type DraftImpactProjection,
  type DraftImpactFocus,
  type DraftImpactPosition,
} from "../game/draftImpact";
import {
  ROSTER_SLOTS,
  SLOT_NAMES,
  type Pokemon,
  type Roster,
  type RosterSlot,
} from "../game/types";
import { DraftLineupPreview } from "./DraftLineupPreview";
import { Portrait } from "./Portrait";
import { draftImpactChangeLabel as changeLabel } from "./draftImpactFormat";

export function DraftImpactComparison({
  mons,
  roster,
  projections,
  pending,
  slot,
  focus,
  onSlot,
  onFocus,
  onReview,
  lockedSlots = [],
}: {
  mons: Pokemon[];
  roster: Roster;
  projections: DraftImpactProjection[];
  pending: boolean;
  slot: DraftImpactPosition;
  focus: DraftImpactFocus;
  onSlot: (slot: DraftImpactPosition) => void;
  onFocus: (focus: DraftImpactFocus) => void;
  onReview: (id: number, slot: RosterSlot) => void;
  lockedSlots?: readonly RosterSlot[];
}) {
  const vacancies = ROSTER_SLOTS.filter((slot) => roster[slot] === null);
  const prospects = useMemo(() => {
    const best = new Map(
      bestDraftImpacts(projections, focus).map((p) => [p.pokemonId, p]),
    );
    return mons.flatMap((mon) => {
      const projection = best.get(mon.id);
      return projection ? [{ ...projection, mon }] : [];
    });
  }, [projections, focus, mons]);
  if (pending) return <p role="status">Finding lineups for this priority…</p>;
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
      className={`draft-comparison draft-impact-comparison ${slot === "best-lineup" ? "has-lineup-moves" : ""}`}
      aria-label="Compare team impact"
    >
      <h4>Who helps your team most?</h4>
      <p>
        Each option adds one player to the same roster · {currentCount} drafted
        players · same coaching and rotation.
        {slot === "best-lineup" &&
          " Unlocked players can change positions, including starter/bench swaps. Changes compare against the same current-roster baseline with your locks applied."}
        {slot === "best-open" &&
          " Each player uses their own best open position for the selected priority."}
      </p>
      <div className="draft-impact-compare-controls">
        <label>
          Preview draft position
          <select
            value={slot}
            onChange={(e) => onSlot(e.target.value as DraftImpactPosition)}
          >
            <option value="best-lineup">Best lineup found · allow moves</option>
            <option value="best-open">Best open position · automatic</option>
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
          {leaders.length > 1 ? "JOINT LEADERS" : "SHORTLIST LEADER"} ·{" "}
          {slot === "best-lineup"
            ? "BEST LINEUPS FOUND"
            : slot === "best-open"
              ? "BEST OPEN POSITIONS"
              : slot}
        </span>
        <strong>{leaderNames}</strong>
        <p>
          {leadingMetric.label}: {leadingMetric.after.toFixed(1)} projected
          {leadingMetric.delta !== null
            ? ` (${changeLabel(leadingMetric.delta)} vs ${slot === "best-lineup" ? "rearranged baseline" : "now"})`
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
                {slot === "best-lineup" ? "Rearranged baseline" : "Now"}
              </th>
              {prospects.map(({ mon, slot: chosenSlot }) => (
                <th scope="col" key={mon.id}>
                  <Portrait mon={mon} />
                  <strong>{mon.name}</strong>
                  <small>
                    With {mon.name} at {chosenSlot}
                  </small>
                  <button
                    className="text-button"
                    onClick={() => onReview(mon.id, chosenSlot)}
                  >
                    Review {mon.name} pick
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slot === "best-lineup" && (
              <tr>
                <th scope="row">Lineup & moves</th>
                <td>
                  <DraftLineupPreview
                    current={roster}
                    proposed={prospects[0].lineup!.before}
                    lockedSlots={lockedSlots}
                  />
                </td>
                {prospects.map((p) => (
                  <td key={p.pokemonId}>
                    <DraftLineupPreview
                      current={roster}
                      proposed={p.lineup!.after}
                      lockedSlots={lockedSlots}
                      pokemonId={p.pokemonId}
                    />
                  </td>
                ))}
              </tr>
            )}
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
                          {metric.delta !== null &&
                            (slot === "best-lineup"
                              ? " vs baseline"
                              : " vs now")}
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
          {slot === "best-lineup" &&
            " Every column uses the exact lineup from the pool ranking. A bounded search checks multiple starting arrangements and swaps, using the actual engine ratings. It finds strong lineups without guaranteeing the global maximum."}
          {slot === "best-open" &&
            " Each player's position is selected for your chosen priority; all rows describe that one lineup. Position ties favor balanced offense and defense, then starter slots and roster order."}
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
