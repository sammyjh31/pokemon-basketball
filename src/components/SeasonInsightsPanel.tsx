import { useEffect, useRef, useState } from "react";
import {
  buildSeasonInsights,
  playerTrendSummary,
  type InsightMatchResolver,
  type PlayerGameTrend,
  type SeasonInsights,
} from "../game/insightAnalysis";
import type { LeagueResult } from "../game/types";
import {
  DefenseInsightsTable,
  LineupInsightsTable,
  insightNumber,
  insightPlayerName,
} from "./GameInsightsPanel";
import "../insights.css";

function PlayerTrend({
  rows,
  league,
}: {
  rows: PlayerGameTrend[];
  league: LeagueResult;
}) {
  const samples = rows.filter((row) => row.status === "played"),
    maximum = Math.max(10, ...samples.map((row) => row.points));
  const point = (row: PlayerGameTrend, index: number) =>
    `${35 + (index / Math.max(1, rows.length - 1)) * 610},${145 - (row.points / maximum) * 115}`;
  return (
    <section className="insight-section">
      <h4>Player game trends</h4>
      <p>
        Averages use appearances within the last 5 or 10 team games. DNP and
        unavailable rows are excluded, with the actual sample shown.
      </p>
      <div className="insight-trend-cards">
        {[5, 10].map((window) => {
          const summary = playerTrendSummary(rows, window);
          return (
            <article key={window}>
              <h5>Last {window} team games</h5>
              <strong>
                {insightNumber(summary.points)} <small>PPG</small>
              </strong>
              <p>
                {insightNumber(summary.rebounds)} rebounds ·{" "}
                {insightNumber(summary.assists)} assists ·{" "}
                {insightNumber(summary.minutes)} minutes
              </p>
              <span>
                {summary.games} appearances / {summary.scheduled} team games
              </span>
            </article>
          );
        })}
      </div>
      {samples.length ? (
        <figure className="insight-trend-figure">
          <svg
            viewBox="0 0 670 180"
            role="img"
            aria-label={`Points by game: ${samples.length} appearances. DNP and unavailable games are gaps; the table contains every game.`}
          >
            <path className="trend-axis" d="M35,20V145H645" />
            <path className="trend-grid" d="M35,30H645 M35,87.5H645" />
            <text x="5" y="34">
              {maximum}
            </text>
            <text x="17" y="149">
              0
            </text>
            {rows.map((row, index) =>
              row.status === "played" ? (
                <g key={row.gameId}>
                  {index > 0 && rows[index - 1].status === "played" && (
                    <polyline
                      className="trend-line"
                      points={`${point(rows[index - 1], index - 1)} ${point(row, index)}`}
                    />
                  )}
                  <circle
                    className="trend-point"
                    cx={35 + (index / Math.max(1, rows.length - 1)) * 610}
                    cy={145 - (row.points / maximum) * 115}
                    r="3"
                  >
                    <title>
                      Game {index + 1}: {row.points} points
                    </title>
                  </circle>
                </g>
              ) : null,
            )}
            <text x="35" y="170">
              Game 1
            </text>
            <text x="645" y="170" textAnchor="end">
              Game {rows.length}
            </text>
          </svg>
          <figcaption>
            Points per appearance. Missing and DNP games break the line.
          </figcaption>
        </figure>
      ) : (
        <p className="insight-empty">
          No player appearances in the available game samples.
        </p>
      )}
      <div
        className="results-table-wrap insight-trend-table"
        role="region"
        tabIndex={0}
        aria-label="Scrollable player game trends"
      >
        <table className="results-table">
          <caption className="sr-only">Player game trends</caption>
          <thead>
            <tr>
              {[
                "GAME / ROUND",
                "OPPONENT",
                "STATUS",
                "MIN",
                "PTS",
                "REB",
                "AST",
                "FG",
                "+/−",
              ].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.gameId}>
                <th scope="row">
                  {index + 1} / R{row.round + 1}
                </th>
                <td>
                  {row.home ? "vs" : "at"}{" "}
                  {league.teams.find((team) => team.id === row.opponentId)
                    ?.name ?? `Team ${row.opponentId}`}
                </td>
                <td>
                  {row.status === "dnp"
                    ? "DNP"
                    : row.status === "unavailable"
                      ? "Unavailable"
                      : "Played"}
                </td>
                {row.status === "played" ? (
                  <>
                    <td>{insightNumber(row.minutes)}</td>
                    <td>{row.points}</td>
                    <td>{row.rebounds}</td>
                    <td>{row.assists}</td>
                    <td>
                      {row.fgm}–{row.fga}
                    </td>
                    <td>
                      {row.plusMinus > 0 ? "+" : ""}
                      {row.plusMinus}
                    </td>
                  </>
                ) : (
                  <td colSpan={6}>—</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SeasonInsightsPanel({
  league,
  resolveMatch,
}: {
  league: LeagueResult;
  resolveMatch?: InsightMatchResolver;
}) {
  const [data, setData] = useState<SeasonInsights | null>(null),
    [status, setStatus] = useState<
      "idle" | "loading" | "done" | "cancelled" | "error"
    >("idle"),
    [progress, setProgress] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState(league.teams[0]?.id ?? 0),
    [selectedPlayer, setSelectedPlayer] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setData(null);
    setStatus("idle");
    setProgress(0);
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, [league, resolveMatch]);
  const build = async () => {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setStatus("loading");
    setProgress(0);
    try {
      const result = await buildSeasonInsights(league, {
        resolveMatch,
        signal: active.signal,
        onProgress: (done) => {
          if (controller.current === active) setProgress(done);
        },
      });
      if (!active.signal.aborted && controller.current === active) {
        setData(result);
        setStatus("done");
      }
    } catch (error) {
      if (controller.current === active)
        setStatus(
          active.signal.aborted ||
            (error instanceof Error && error.name === "AbortError")
            ? "cancelled"
            : "error",
        );
    }
  };
  const team =
    league.teams.find((item) => item.id === selectedTeam) ?? league.teams[0];
  const ids = team
    ? Object.values(team.roster)
        .filter((id) => id !== null)
        .map((id) => `${team.id}:${id}`)
    : [];
  const playerId = ids.includes(selectedPlayer) ? selectedPlayer : ids[0];
  return (
    <section className="season-insights" aria-label="Season insights">
      <h3>Season lab</h3>
      <p>
        Inspect game-by-game player trends, five-player groups and recorded
        defensive work. Analysis replays frozen season inputs on demand and
        keeps compact summaries in memory.
      </p>
      {!league.games.length || !team ? (
        <p className="insight-empty">
          No completed games are available for season insights.
        </p>
      ) : (
        <>
          <div className="insight-build-row">
            {!data && status !== "loading" && (
              <button
                className="insight-button"
                type="button"
                onClick={() => void build()}
              >
                Build season insights
              </button>
            )}
            {status === "loading" && (
              <>
                <progress
                  max={league.games.length}
                  value={progress}
                  aria-label="Season insight progress"
                />
                <button
                  className="insight-button"
                  type="button"
                  onClick={() => controller.current?.abort()}
                >
                  Cancel analysis
                </button>
              </>
            )}
            <p role="status">
              {status === "loading"
                ? `Analyzing ${progress} / ${league.games.length} games…`
                : status === "cancelled"
                  ? "Analysis cancelled. Build again to restart."
                  : status === "error"
                    ? "Analysis could not be completed. Build again to retry."
                    : status === "done"
                      ? `Analysis ready · ${progress} games checked.`
                      : `${league.games.length} completed games ready to analyze.`}
            </p>
          </div>
          {data && (
            <>
              <p className="insight-note">
                {data.detailGames} of {data.games} games include recorded
                telemetry. {data.missingTelemetryGames} have valid boxes but no
                shot, lineup or defensive detail; {data.unavailableGames} could
                not be replayed consistently and are excluded. Historical and
                official played games without telemetry are never filled with
                estimated events.
              </p>
              <div className="insight-controls">
                <label>
                  Insight team
                  <select
                    value={team.id}
                    onChange={(event) => {
                      setSelectedTeam(Number(event.target.value));
                      setSelectedPlayer("");
                    }}
                  >
                    {league.teams.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Trend player
                  <select
                    value={playerId ?? ""}
                    onChange={(event) => setSelectedPlayer(event.target.value)}
                  >
                    {ids.map((id) => (
                      <option key={id} value={id}>
                        {insightPlayerName(id)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <PlayerTrend
                rows={playerId ? (data.players[playerId] ?? []) : []}
                league={league}
              />
              <LineupInsightsTable
                rows={data.lineups.filter((row) => row.teamId === team.id)}
                teams={league.teams}
              />
              <DefenseInsightsTable
                rows={data.defense.filter((row) => row.teamId === team.id)}
                teams={league.teams}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
