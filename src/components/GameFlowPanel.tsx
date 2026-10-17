import { FIELD_LABELS, type GameFlowReport } from "../game/gameFlow";
import type { LeagueTeam } from "../game/types";
import "../gameFlow.css";

const ROUNDS = ["First round", "Quarterfinals", "Semifinals", "Finals"];
const REASONS = {
  run: "Stop a run",
  rest: "Rest the floor",
  late: "Set up a late play",
} as const;
const restLabel = (days: number) =>
  days === 0 ? "Back-to-back" : days === 1 ? "1 day of rest" : `${days}+ days of rest`;
const clock = (period: number, elapsed: number) => {
  const start = Math.min(period - 1, 4) * 720 + Math.max(0, period - 5) * 300;
  const length = period <= 4 ? 720 : 300;
  const left = Math.max(0, Math.round(length - (elapsed - start)));
  return `${period <= 4 ? `Q${period}` : `OT${period - 4}`} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
};

/** Frozen fixture context and coach decisions for one simulated game. */
export function GameFlowPanel({
  report,
  home,
  away,
}: {
  report?: GameFlowReport;
  home: LeagueTeam;
  away: LeagueTeam;
}) {
  if (!report) return null;
  const name = (id: number) => (id === home.id ? home.name : away.name);
  const p = report.playoff;
  const stage = p
    ? `${ROUNDS[p.round] ?? "Playoffs"} · Game ${p.game} · ${home.name} ${p.homeWins}–${p.awayWins} ${away.name}`
    : "Regular season";
  const elimination = [
    report.elimination.home && home.name,
    report.elimination.away && away.name,
  ].filter(Boolean);
  return (
    <section className="game-flow-panel" aria-label="Game context">
      <h3>Game context</h3>
      <dl className="game-flow-facts">
        <div>
          <dt>Stage</dt>
          <dd>
            {stage}
            {elimination.length > 0 && (
              <span className="game-flow-tag">
                Elimination game for {elimination.join(" and ")}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Officials</dt>
          <dd>{report.referee.label}</dd>
        </div>
        <div>
          <dt>Arena</dt>
          <dd>
            {home.name}: {FIELD_LABELS[report.arena.condition]}
            {report.setterPossessions > 0 &&
              ` · weather-setting abilities changed the court for ${report.setterPossessions} possessions`}
          </dd>
        </div>
        {[
          { team: away, side: "away" as const },
          { team: home, side: "home" as const },
        ].map(({ team, side }) => (
          <div key={team.id}>
            <dt>{team.name}</dt>
            <dd>
              {restLabel(report.rest[side])}
              {report.trip[side] > 1 && ` · road game ${report.trip[side]} of the trip`}
              {report.loadManaged[side] && " · coach managed starters’ minutes"}
            </dd>
          </div>
        ))}
      </dl>
      {report.notes.length > 0 && (
        <ul className="game-flow-notes">
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {report.timeouts.length > 0 ? (
        <details className="game-flow-timeouts">
          <summary>Timeouts ({report.timeouts.length})</summary>
          <div
            className="results-table-wrap"
            role="region"
            tabIndex={0}
            aria-label="Scrollable timeouts"
          >
          <table className="results-table">
            <caption className="sr-only">Coach timeouts</caption>
            <thead>
              <tr>
                <th scope="col">TIME</th>
                <th scope="col">TEAM</th>
                <th scope="col">REASON</th>
                <th scope="col">RUN</th>
                <th scope="col">MARGIN</th>
                <th scope="col">ENERGY</th>
              </tr>
            </thead>
            <tbody>
              {report.timeouts.map((t, i) => (
                <tr key={i}>
                  <th scope="row">{clock(t.period, t.elapsedSeconds)}</th>
                  <td>{name(t.teamId)}</td>
                  <td>{REASONS[t.reason]}</td>
                  <td>{t.run ? `${t.run}–0` : "—"}</td>
                  <td>{t.margin > 0 ? `+${t.margin}` : t.margin}</td>
                  <td>{Math.round(t.energy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </details>
      ) : (
        <p className="game-flow-note">No timeouts were needed.</p>
      )}
    </section>
  );
}
