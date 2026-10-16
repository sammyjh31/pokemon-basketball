import { useMemo, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  gameDrivers,
  lineupMetrics,
  shotSummary,
} from "../game/insightAnalysis";
import type {
  DefenseSummary,
  LineupSummary,
  ShotEvent,
} from "../game/engineInsightsTypes";
import type { LeagueMatch, LeagueTeam } from "../game/types";
import "../insights.css";

export const insightPlayerName = (id: string) => {
  const pokemonId = Number(id.split(":").at(-1));
  return POKEMON_BY_ID.get(pokemonId)?.name ?? `#${pokemonId}`;
};
export const insightNumber = (value: number | null, decimals = 1) =>
  value === null || !Number.isFinite(value) ? "—" : value.toFixed(decimals);
const signed = (value: number) =>
  `${value > 0 ? "+" : ""}${insightNumber(value)}`;
const zoneName = { rim: "Rim", mid: "Midrange", three: "Three-point" };

export function LineupInsightsTable({
  rows,
  teams,
}: {
  rows: (LineupSummary & { games?: number })[];
  teams: LeagueTeam[];
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...rows].sort((a, b) => b.seconds - a.seconds),
    visible = showAll ? sorted : sorted.slice(0, 20);
  return (
    <section className="insight-section">
      <h4>Five-player lineups</h4>
      <p>
        Minutes and scoring while these five shared the court. PTS/100 uses
        offensive possessions started by the group; a foul-out substitution can
        occur before a possession ends. Small samples are noisy.
      </p>
      {!rows.length ? (
        <p>No recorded five-player lineup samples.</p>
      ) : (
        <>
          <div
            className="results-table-wrap"
            role="region"
            tabIndex={0}
            aria-label="Scrollable five-player lineups"
          >
            <table className="results-table insight-lineups">
              <caption className="sr-only">Five-player lineups</caption>
              <thead>
                <tr>
                  {[
                    "LINEUP",
                    "GAMES",
                    "MIN",
                    "OFF. STARTS",
                    "PTS FOR",
                    "PTS AGAINST",
                    "+/−",
                    "PTS/100",
                  ].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const metric = lineupMetrics(row);
                  return (
                    <tr
                      key={`${row.teamId}:${[...row.playerIds].sort().join("|")}`}
                    >
                      <th scope="row">
                        <small>
                          {teams.find((team) => team.id === row.teamId)?.name ??
                            `Team ${row.teamId}`}
                        </small>
                        {row.playerIds.map(insightPlayerName).join(" · ")}
                      </th>
                      <td>{row.games ?? 1}</td>
                      <td>{insightNumber(metric.minutes)}</td>
                      <td>{row.possessions}</td>
                      <td>{row.pointsFor}</td>
                      <td>{row.pointsAgainst}</td>
                      <td>{signed(metric.plusMinus)}</td>
                      <td>{insightNumber(metric.pointsPer100)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > 20 && (
            <button
              className="insight-button"
              type="button"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? "Show 20 most-used lineups"
                : `Show all ${sorted.length} lineups`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function DefenseInsightsTable({
  rows,
  teams,
}: {
  rows: (DefenseSummary & { games?: number })[];
  teams: LeagueTeam[];
}) {
  return (
    <section className="insight-section">
      <h4>Defensive impact</h4>
      <p>
        Assignments count shot events, including shooting fouls. Actual and
        expected points cover assigned field goals only, excluding free throws.
        Contests, steals, blocks and pass deflections are recorded events, not a
        causal player rating.
      </p>
      {!rows.length ? (
        <p>No recorded defensive assignment samples.</p>
      ) : (
        <div
          className="results-table-wrap"
          role="region"
          tabIndex={0}
          aria-label="Scrollable defensive impact"
        >
          <table className="results-table">
            <caption className="sr-only">Defensive impact</caption>
            <thead>
              <tr>
                {[
                  "DEFENDER",
                  "GAMES",
                  "ASSIGNMENTS",
                  "FGA FACED",
                  "CONTESTS",
                  "FG PTS",
                  "EXPECTED",
                  "ACT − EXP",
                  "STL",
                  "BLK",
                  "DEFLECTIONS",
                  "SHOOTING FOULS",
                ].map((label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows]
                .sort((a, b) => b.matchups - a.matchups)
                .map((row) => (
                  <tr key={row.playerId}>
                    <th scope="row">
                      {insightPlayerName(row.playerId)}
                      <small>
                        {teams.find((team) => team.id === row.teamId)?.name ??
                          `Team ${row.teamId}`}
                      </small>
                    </th>
                    <td>{row.games ?? 1}</td>
                    <td>{row.matchups}</td>
                    <td>{row.attempts}</td>
                    <td>{row.contests}</td>
                    <td>{row.pointsAllowed}</td>
                    <td>{insightNumber(row.expectedPointsAllowed)}</td>
                    <td>
                      {signed(row.pointsAllowed - row.expectedPointsAllowed)}
                    </td>
                    <td>{row.steals}</td>
                    <td>{row.blocks}</td>
                    <td>{row.deflections}</td>
                    <td>{row.shootingFouls}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ShotChart({
  shots,
  home,
  away,
}: {
  shots: ShotEvent[];
  home: LeagueTeam;
  away: LeagueTeam;
}) {
  const [teamId, setTeamId] = useState(home.id),
    [playerId, setPlayerId] = useState("all"),
    [outcome, setOutcome] = useState("all");
  const team = teamId === away.id ? away : home;
  const selected = shots.filter(
    (shot) =>
      shot.offenseTeamId === team.id &&
      (playerId === "all" || shot.shooterId === playerId) &&
      (outcome === "all" || (outcome === "makes" ? shot.made : !shot.made)),
  );
  const summary = shotSummary(selected),
    misses = selected.length - summary.made;
  return (
    <section className="insight-section">
      <h4>Recorded shot chart</h4>
      <p>
        Schematic locations within the recorded shot zone, not tracked court
        positions. The coordinates do not influence the simulation.
      </p>
      <div className="insight-controls">
        <label>
          Shot chart team
          <select
            value={team.id}
            onChange={(event) => {
              setTeamId(Number(event.target.value));
              setPlayerId("all");
            }}
          >
            {[home, away].map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Shot chart player
          <select
            value={playerId}
            onChange={(event) => setPlayerId(event.target.value)}
          >
            <option value="all">All players</option>
            {Object.values(team.roster)
              .filter((id) => id !== null)
              .map((id) => (
                <option key={id} value={`${team.id}:${id}`}>
                  {insightPlayerName(`${team.id}:${id}`)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Shot result
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          >
            <option value="all">All results</option>
            <option value="makes">Makes</option>
            <option value="misses">Misses / blocks / foul misses</option>
          </select>
        </label>
      </div>
      <div className="insight-chart-layout">
        <figure className="insight-shot-figure">
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={`Shot chart for ${team.name}: ${summary.made} makes, ${misses} misses. ${selected.length} recorded events.`}
          >
            <rect
              className="court-line"
              x="2"
              y="2"
              width="96"
              height="96"
              rx="1"
            />
            <path
              className="court-line"
              d="M 35,2 V 43 H 65 V 2 M 39,43 A 11,11 0 0 0 61,43 M 7,2 V 22 A 43,43 0 0 0 93,22 V 2 M 43,6 H 57"
            />
            <circle className="court-line" cx="50" cy="10" r="2.5" />
            {selected.map((shot) => (
              <g
                key={shot.index}
                className={shot.made ? "shot-made" : "shot-missed"}
              >
                <title>
                  {insightPlayerName(shot.shooterId)}:{" "}
                  {shot.made
                    ? "Make"
                    : shot.blocked
                      ? "Block"
                      : shot.foul
                        ? "Shooting-foul miss"
                        : "Miss"}
                  , {zoneName[shot.zone]}, period {shot.period}
                </title>
                {shot.made ? (
                  <circle cx={shot.x} cy={shot.y} r="1.6" />
                ) : (
                  <path
                    d={`M${shot.x - 1.4},${shot.y - 1.4}l2.8,2.8m-2.8,0l2.8,-2.8`}
                  />
                )}
              </g>
            ))}
          </svg>
          <figcaption>
            ● Made basket · × Miss, block or shooting-foul miss. The event log
            identifies each result.
          </figcaption>
        </figure>
        <div className="insight-shot-summary">
          <strong>
            {summary.made} / {summary.attempts} FG
          </strong>
          <span>
            {insightNumber(summary.fieldGoalPercent)}% · {summary.events} shot
            events
          </span>
          <p>
            {summary.points} field-goal points from{" "}
            {insightNumber(summary.expectedPoints)} expected. Shooting-foul
            misses appear on the chart but do not count as official FGA.
          </p>
          <table className="results-table">
            <caption className="sr-only">Shot zone breakdown</caption>
            <thead>
              <tr>
                <th scope="col">ZONE</th>
                <th scope="col">FG</th>
                <th scope="col">FG%</th>
              </tr>
            </thead>
            <tbody>
              {(["rim", "mid", "three"] as const).map((zone) => {
                const row = shotSummary(
                  selected.filter((shot) => shot.zone === zone),
                );
                return (
                  <tr key={zone}>
                    <th scope="row">{zoneName[zone]}</th>
                    <td>
                      {row.made}–{row.attempts}
                    </td>
                    <td>{insightNumber(row.fieldGoalPercent)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {!selected.length && (
        <p className="insight-empty">
          No recorded shots for this selection. A player may have played without
          taking a shot, or did not play.
        </p>
      )}
      <details className="insight-details">
        <summary>Inspect {selected.length} recorded shot events</summary>
        <div
          className="results-table-wrap"
          role="region"
          tabIndex={0}
          aria-label="Scrollable shot event log"
        >
          <table className="results-table">
            <caption className="sr-only">Recorded shot events</caption>
            <thead>
              <tr>
                {[
                  "PERIOD",
                  "ELAPSED",
                  "SHOOTER",
                  "ZONE",
                  "RESULT",
                  "DEFENDER",
                  "CONTEST",
                  "EXPECTED MAKE",
                ].map((label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.map((shot) => (
                <tr key={shot.index}>
                  <td>
                    {shot.period <= 4
                      ? `Q${shot.period}`
                      : `OT${shot.period - 4}`}
                  </td>
                  <td>
                    {Math.floor(shot.elapsedSeconds / 60)}:
                    {String(Math.floor(shot.elapsedSeconds % 60)).padStart(
                      2,
                      "0",
                    )}
                  </td>
                  <th scope="row">{insightPlayerName(shot.shooterId)}</th>
                  <td>{zoneName[shot.zone]}</td>
                  <td>
                    {shot.made
                      ? shot.foul
                        ? "Make + foul"
                        : "Make"
                      : shot.blocked
                        ? "Blocked"
                        : shot.foul
                          ? "Foul miss · no FGA"
                          : "Miss"}
                  </td>
                  <td>{insightPlayerName(shot.defenderId)}</td>
                  <td>{shot.contested ? "Contested" : "Uncontested"}</td>
                  <td>{insightNumber(shot.expectedProbability * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function GameInsightsPanel({
  match,
  home,
  away,
}: {
  match: LeagueMatch;
  home: LeagueTeam;
  away: LeagueTeam;
}) {
  const drivers = useMemo(() => gameDrivers(match), [match]);
  return (
    <section className="game-insights" aria-label="Game insights">
      <h3>Inside this result</h3>
      <p>
        Recorded comparisons describe where the teams differed. They do not
        prove why one team won.
      </p>
      <div className="insight-driver-notes">
        <p>
          {drivers.turnovers.home === drivers.turnovers.away
            ? `Both teams committed ${drivers.turnovers.home} turnovers.`
            : `${drivers.turnovers.home < drivers.turnovers.away ? home.name : away.name} had ${Math.abs(drivers.turnovers.home - drivers.turnovers.away)} fewer turnovers (${Math.min(drivers.turnovers.home, drivers.turnovers.away)} versus ${Math.max(drivers.turnovers.home, drivers.turnovers.away)}).`}
        </p>
        <p>
          {home.name} collected {drivers.offensiveRebounds.home} offensive
          rebounds; {away.name} collected {drivers.offensiveRebounds.away}. Made
          free throws contributed {drivers.freeThrows.home} and{" "}
          {drivers.freeThrows.away} points, respectively.
        </p>
        {drivers.shooting && (
          <p>
            Across {drivers.shooting.home.events + drivers.shooting.away.events}{" "}
            recorded shot events, {home.name} finished{" "}
            {signed(
              drivers.shooting.home.points -
                drivers.shooting.home.expectedPoints,
            )}{" "}
            field-goal points versus expectation; {away.name} finished{" "}
            {signed(
              drivers.shooting.away.points -
                drivers.shooting.away.expectedPoints,
            )}
            .
          </p>
        )}
      </div>
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable recorded comparisons"
      >
        <table className="results-table">
          <caption className="sr-only">Recorded game comparisons</caption>
          <thead>
            <tr>
              <th scope="col">MEASURE</th>
              <th scope="col">{home.name}</th>
              <th scope="col">{away.name}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Turnovers</th>
              <td>{drivers.turnovers.home}</td>
              <td>{drivers.turnovers.away}</td>
            </tr>
            <tr>
              <th scope="row">Offensive rebounds / second chances</th>
              <td>{drivers.offensiveRebounds.home}</td>
              <td>{drivers.offensiveRebounds.away}</td>
            </tr>
            <tr>
              <th scope="row">Free throws made</th>
              <td>{drivers.freeThrows.home}</td>
              <td>{drivers.freeThrows.away}</td>
            </tr>
            {drivers.shooting && (
              <>
                <tr>
                  <th scope="row">Recorded field-goal points</th>
                  <td>{drivers.shooting.home.points}</td>
                  <td>{drivers.shooting.away.points}</td>
                </tr>
                <tr>
                  <th scope="row">Expected field-goal points</th>
                  <td>{insightNumber(drivers.shooting.home.expectedPoints)}</td>
                  <td>{insightNumber(drivers.shooting.away.expectedPoints)}</td>
                </tr>
                <tr>
                  <th scope="row">FG points above / below expectation</th>
                  <td>
                    {signed(
                      drivers.shooting.home.points -
                        drivers.shooting.home.expectedPoints,
                    )}
                  </td>
                  <td>
                    {signed(
                      drivers.shooting.away.points -
                        drivers.shooting.away.expectedPoints,
                    )}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      <p className="insight-note">
        Offensive rebounds count extra opportunities, not points scored on them.
        Expected field-goal points sum each recorded event’s model chance × shot
        value, including shooting-foul events; free throws are separate.
        Finishing variance is actual minus expected.
      </p>
      {!match.insights ? (
        <p className="insight-empty">
          Shot locations, lineups and defensive assignments were not recorded
          for this game. Historical and played official results remain valid; no
          missing telemetry is estimated.
        </p>
      ) : (
        <>
          <ShotChart shots={match.insights.shots} home={home} away={away} />
          <LineupInsightsTable
            rows={match.insights.lineups}
            teams={[home, away]}
          />
          <DefenseInsightsTable
            rows={match.insights.defense}
            teams={[home, away]}
          />
          <section className="insight-section">
            <h4>Coaching adjustments</h4>
            {match.insights.adjustments.length ? (
              <ol className="insight-adjustments">
                {match.insights.adjustments.map((change, index) => (
                  <li key={index}>
                    <strong>
                      {change.teamId === home.id ? home.name : away.name} ·{" "}
                      {change.period <= 4
                        ? `Q${change.period}`
                        : `OT${change.period - 4}`}
                    </strong>
                    <span>
                      {change.kind}: {change.from} → {change.to}
                    </span>
                    <p>
                      {change.reason} {change.evidence}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No adaptive coaching changes were recorded.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
