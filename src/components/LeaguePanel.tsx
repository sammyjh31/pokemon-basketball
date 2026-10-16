import { useId, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { bestPosition, positionRating } from "../game/ratings";
import {
  DEFENSE_LABELS,
  POSITIONS,
  ROSTER_SLOTS,
  TACTIC_LABELS,
  type LeagueGameSummary,
  type LeaguePlayer,
  type LeagueResult,
  type LeagueTeam,
  type Position,
  type Standing,
} from "../game/types";
import { LeagueBoxScore } from "./LeagueBoxScore";
import { Portrait } from "./Portrait";
import "../league.css";

const name = (id: number) => POKEMON_BY_ID.get(id)?.name ?? `#${id}`;
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const perGame = (p: LeaguePlayer, value: number) => ratio(value, p.gamesPlayed);
const rebounds = (p: LeaguePlayer) => p.offensiveRebounds + p.defensiveRebounds;
type Column = {
  key: string;
  label: string;
  title: string;
  value: (p: LeaguePlayer) => number | null;
  kind?: "count" | "percentage" | "ratio";
  qualified?: (p: LeaguePlayer) => boolean;
};
const columns: Column[] = [
  { key: "points", label: "PTS", title: "points", value: (p) => p.points },
  { key: "rebounds", label: "REB", title: "rebounds", value: rebounds },
  { key: "assists", label: "AST", title: "assists", value: (p) => p.assists },
  {
    key: "gp",
    label: "GP",
    title: "games played",
    value: (p) => p.gamesPlayed,
    kind: "count",
  },
  {
    key: "gs",
    label: "GS",
    title: "games started",
    value: (p) => p.gamesStarted,
    kind: "count",
  },
  { key: "minutes", label: "MIN", title: "minutes", value: (p) => p.minutes },
  { key: "steals", label: "STL", title: "steals", value: (p) => p.steals },
  { key: "blocks", label: "BLK", title: "blocks", value: (p) => p.blocks },
  {
    key: "turnovers",
    label: "TOV",
    title: "turnovers",
    value: (p) => p.turnovers,
  },
  {
    key: "fg",
    label: "FG%",
    title: "field goal percentage",
    value: (p) => ratio(p.fgm * 100, p.fga),
    kind: "percentage",
    qualified: (p) => p.fga >= 300,
  },
  {
    key: "three",
    label: "3P%",
    title: "three point percentage",
    value: (p) => ratio(p.threePM * 100, p.threePA),
    kind: "percentage",
    qualified: (p) => p.threePA >= 82,
  },
  {
    key: "ft",
    label: "FT%",
    title: "free throw percentage",
    value: (p) => ratio(p.ftm * 100, p.fta),
    kind: "percentage",
    qualified: (p) => p.fta >= 125,
  },
  {
    key: "ts",
    label: "TS%",
    title: "true shooting percentage",
    value: (p) => ratio(p.points * 100, 2 * (p.fga + 0.44 * p.fta)),
    kind: "percentage",
    qualified: (p) => p.fga >= 300,
  },
  {
    key: "pts36",
    label: "PTS/36",
    title: "points per 36 minutes",
    value: (p) => ratio(p.points * 36, p.minutes),
    kind: "ratio",
  },
  {
    key: "reb36",
    label: "REB/36",
    title: "rebounds per 36 minutes",
    value: (p) => ratio(rebounds(p) * 36, p.minutes),
    kind: "ratio",
  },
  {
    key: "ast36",
    label: "AST/36",
    title: "assists per 36 minutes",
    value: (p) => ratio(p.assists * 36, p.minutes),
    kind: "ratio",
  },
  {
    key: "astTov",
    label: "AST/TOV",
    title: "assist to turnover ratio",
    value: (p) => ratio(p.assists, p.turnovers),
    kind: "ratio",
  },
  { key: "fouls", label: "PF", title: "personal fouls", value: (p) => p.fouls },
  {
    key: "plusMinus",
    label: "+/−",
    title: "plus minus",
    value: (p) => p.plusMinus,
  },
];
const formatted = (
  value: number | null,
  kind?: Column["kind"],
  totals = false,
) =>
  value === null
    ? "—"
    : kind === "percentage"
      ? `${value.toFixed(1)}%`
      : kind === "count" || (totals && !kind)
        ? value.toLocaleString("en-US", { maximumFractionDigits: 1 })
        : value.toFixed(1);
const playerLabel = (p: LeaguePlayer) => `${name(p.pokemonId)} · ${p.teamName}`;
function TeamSelect({
  teams,
  value,
  onChange,
  label,
  all = true,
}: {
  teams: LeagueTeam[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  all?: boolean;
}) {
  return (
    <label className="league-field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {all && <option value="all">All teams</option>}
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function PlayerName({ player }: { player: LeaguePlayer }) {
  const mon = POKEMON_BY_ID.get(player.pokemonId);
  return (
    <span className="stat-player">
      {mon && (
        <span aria-hidden="true">
          <Portrait mon={mon} />
        </span>
      )}
      <span>
        {name(player.pokemonId)}
        <small>
          {player.teamName} · {player.slot}
        </small>
      </span>
    </span>
  );
}
function Leaders({ league }: { league: LeagueResult }) {
  const [team, setTeam] = useState("all"),
    [query, setQuery] = useState(""),
    [totals, setTotals] = useState(false),
    [qualified, setQualified] = useState(false);
  const [sort, setSort] = useState({ key: "points", descending: true });
  const column = columns.find((c) => c.key === sort.key)!;
  const value = (p: LeaguePlayer, c: Column) => {
    const n = c.value(p);
    return n === null || c.kind || totals ? n : perGame(p, n);
  };
  const players = league.players
    .filter(
      (p) =>
        (team === "all" || p.teamId === Number(team)) &&
        playerLabel(p).toLowerCase().includes(query.toLowerCase()) &&
        (!qualified ||
          (p.gamesPlayed >= 58 && (!column.qualified || column.qualified(p)))),
    )
    .sort((a, b) => {
      const av = value(a, column),
        bv = value(b, column);
      return av === null
        ? bv === null
          ? a.playerId.localeCompare(b.playerId)
          : 1
        : bv === null
          ? -1
          : (av - bv) * (sort.descending ? -1 : 1) ||
            a.playerId.localeCompare(b.playerId);
    });
  return (
    <section aria-label="League player leaders">
      <div className="results-section-heading">
        <div>
          <h4>Every player. Every possession.</h4>
          <p>
            {players.length} of {league.players.length} players · Select a
            column to sort.
          </p>
        </div>
        <div
          className="stat-mode"
          role="group"
          aria-label="League statistics display"
        >
          <button
            type="button"
            aria-pressed={!totals}
            onClick={() => setTotals(false)}
          >
            Per game
          </button>
          <button
            type="button"
            aria-pressed={totals}
            onClick={() => setTotals(true)}
          >
            Totals
          </button>
        </div>
      </div>
      <div className="league-controls">
        <label className="league-field">
          Search league players
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Player or team name"
          />
        </label>
        <TeamSelect
          teams={league.teams}
          value={team}
          onChange={setTeam}
          label="Filter players by team"
        />
        <label className="league-checkbox">
          <input
            type="checkbox"
            checked={qualified}
            onChange={(e) => setQualified(e.target.checked)}
          />
          Qualified leaders only
        </label>
      </div>
      <div
        className="results-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Scrollable league player statistics"
      >
        <table className="results-table league-leaders-table">
          <caption className="sr-only">
            League player statistics —{" "}
            {totals ? "season totals" : "per game averages"}
          </caption>
          <thead>
            <tr>
              <th scope="col">PLAYER / TEAM</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    sort.key === c.key
                      ? sort.descending
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    aria-label={`Sort league by ${c.title}`}
                    onClick={() =>
                      setSort({
                        key: c.key,
                        descending:
                          sort.key === c.key ? !sort.descending : true,
                      })
                    }
                  >
                    {c.label}
                    <span aria-hidden="true" className="sort-direction">
                      {sort.key === c.key ? (sort.descending ? "↓" : "↑") : "↕"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.playerId}>
                <th scope="row">
                  <PlayerName player={p} />
                </th>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={sort.key === c.key ? "sorted-stat" : undefined}
                  >
                    {formatted(value(p, c), c.kind, totals)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!players.length && (
        <p className="league-empty">No players match these filters.</p>
      )}
      <p className="stat-legend">
        Per-game points, rebounds and assists are PPG, RPG and APG. Qualified
        leaders require 58 games. When sorting percentages, also require 300 FGA
        for FG% / TS%, 82 three-point attempts for 3P%, or 125 FTA for FT%. TS%
        = PTS ÷ [2 × (FGA + 0.44 × FTA)]. Per-36 and AST/TOV are ratios in both
        modes. — means no denominator.
      </p>
    </section>
  );
}
const standingColumns: {
  key: string;
  label: string;
  title: string;
  value: (s: Standing) => number;
  format?: (n: number) => string;
}[] = [
  { key: "wins", label: "W", title: "wins", value: (s) => s.wins },
  { key: "losses", label: "L", title: "losses", value: (s) => s.losses },
  {
    key: "pct",
    label: "WIN%",
    title: "win percentage",
    value: (s) => (s.wins / (s.wins + s.losses || 1)) * 100,
    format: (n) => `${n.toFixed(1)}%`,
  },
  {
    key: "ppg",
    label: "PPG",
    title: "points per game",
    value: (s) => s.pointsFor / (s.wins + s.losses || 1),
    format: (n) => n.toFixed(1),
  },
  {
    key: "opp",
    label: "OPP",
    title: "opponent points per game",
    value: (s) => s.pointsAgainst / (s.wins + s.losses || 1),
    format: (n) => n.toFixed(1),
  },
  {
    key: "diff",
    label: "DIFF",
    title: "point differential",
    value: (s) => (s.pointsFor - s.pointsAgainst) / (s.wins + s.losses || 1),
    format: (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`,
  },
  {
    key: "home",
    label: "HOME W",
    title: "home wins",
    value: (s) => s.homeWins,
  },
  {
    key: "away",
    label: "AWAY W",
    title: "away wins",
    value: (s) => s.awayWins,
  },
  {
    key: "lastTen",
    label: "LAST 10",
    title: "last ten wins",
    value: (s) => s.lastTen,
    format: (n) => `${n}–${10 - n}`,
  },
  {
    key: "streak",
    label: "STREAK",
    title: "streak",
    value: (s) => s.streak,
    format: (n) => `${n >= 0 ? "W" : "L"}${Math.abs(n)}`,
  },
];
function Standings({
  league,
  onTeam,
}: {
  league: LeagueResult;
  onTeam: (teamId: number) => void;
}) {
  const [sort, setSort] = useState({ key: "wins", descending: true });
  const column = standingColumns.find((c) => c.key === sort.key)!;
  const sorted = [...league.standings].sort(
    (a, b) =>
      (column.value(a) - column.value(b)) * (sort.descending ? -1 : 1) ||
      b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
      a.teamId - b.teamId,
  );
  return (
    <section>
      <h4>The league table</h4>
      <p className="stat-legend">
        Select a team to explore its roster. Select a column to sort.
      </p>
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable league standings"
      >
        <table className="results-table league-standings">
          <caption className="sr-only">League standings</caption>
          <thead>
            <tr>
              <th scope="col">TEAM</th>
              {standingColumns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    sort.key === c.key
                      ? sort.descending
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    aria-label={`Sort standings by ${c.title}`}
                    onClick={() =>
                      setSort({
                        key: c.key,
                        descending:
                          sort.key === c.key ? !sort.descending : true,
                      })
                    }
                  >
                    {c.label}
                    <span aria-hidden="true">
                      {sort.key === c.key
                        ? sort.descending
                          ? " ↓"
                          : " ↑"
                        : " ↕"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, index) => (
              <tr
                key={s.teamId}
                className={s.teamId === 0 ? "league-user-team" : undefined}
              >
                <th scope="row">
                  <button
                    className="league-team-link"
                    type="button"
                    onClick={() => onTeam(s.teamId)}
                  >
                    <span className="league-rank">{index + 1}</span>
                    {league.teams.find((t) => t.id === s.teamId)?.name}
                  </button>
                </th>
                {standingColumns.map((c) => (
                  <td key={c.key}>{c.format?.(c.value(s)) ?? c.value(s)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Rosters({
  league,
  teamId,
  setTeamId,
}: {
  league: LeagueResult;
  teamId: string;
  setTeamId: (id: string) => void;
}) {
  const team =
    league.teams.find((t) => String(t.id) === teamId) ?? league.teams[0];
  if (!team) return null;
  return (
    <section>
      <div className="league-controls">
        <TeamSelect
          teams={league.teams}
          value={String(team.id)}
          onChange={setTeamId}
          label="Browse team roster"
          all={false}
        />
      </div>
      <div className="league-team-profile">
        <div>
          <span className="eyebrow">COACHING IDENTITY</span>
          <h4>{team.name}</h4>
          <p>
            {TACTIC_LABELS[team.tactic]} · {DEFENSE_LABELS[team.defense]} ·{" "}
            {team.rotation === "starters"
              ? "Starter-heavy"
              : team.rotation === "bench"
                ? "Deep bench"
                : "Balanced"}{" "}
            rotation
          </p>
        </div>
        <div className="league-team-ratings">
          <span>
            <b>{team.ratings.overall.toFixed(1)}</b>OVERALL
          </span>
          <span>
            <b>{team.ratings.offense.toFixed(1)}</b>OFFENSE
          </span>
          <span>
            <b>{team.ratings.defense.toFixed(1)}</b>DEFENSE
          </span>
        </div>
      </div>
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable team roster"
      >
        <table className="results-table league-roster-table">
          <caption className="sr-only">
            {team.name} roster and season statistics
          </caption>
          <thead>
            <tr>
              {[
                "PLAYER / TEAM",
                "ROLE",
                "POSITION",
                "FIT",
                "GP",
                "MPG",
                "PPG",
                "RPG",
                "APG",
                "FG%",
                "+/−",
              ].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROSTER_SLOTS.map((slot) => {
              const mon = POKEMON_BY_ID.get(team.roster[slot] ?? -1);
              if (!mon) return null;
              const p = league.players.find(
                (p) => p.teamId === team.id && p.pokemonId === mon.id,
              );
              const position = POSITIONS.includes(slot as Position)
                ? (slot as Position)
                : bestPosition(mon);
              return (
                <tr key={`${team.id}:${mon.id}`}>
                  <th scope="row">
                    {p ? <PlayerName player={p} /> : mon.name}
                  </th>
                  <td>{slot.startsWith("B") ? "Reserve" : "Starter"}</td>
                  <td>{position}</td>
                  <td>{positionRating(mon, position).toFixed(1)}</td>
                  <td>{p?.gamesPlayed ?? 0}</td>
                  {[
                    p?.minutes,
                    p?.points,
                    p ? rebounds(p) : undefined,
                    p?.assists,
                  ].map((v, i) => (
                    <td key={i}>
                      {p && v !== undefined ? formatted(perGame(p, v)) : "—"}
                    </td>
                  ))}
                  <td>
                    {p
                      ? formatted(ratio(p.fgm * 100, p.fga), "percentage")
                      : "—"}
                  </td>
                  <td>{p?.plusMinus ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="stat-legend">
        Fit is a 0–100 basketball rating at the assigned position; reserves show
        their best position. +/− is the season total.
      </p>
    </section>
  );
}
function Awards({ league }: { league: LeagueResult }) {
  const teamName = (id: number) =>
    league.teams.find((t) => t.id === id)?.name ?? "Unknown team";
  return (
    <section aria-label="League awards">
      <h4>League awards</h4>
      <p className="stat-legend">
        Honors across every roster. All awards require 58 games; Sixth Player
        also requires more games off the bench than starts. All-League and
        All-Defense are positionless selections.
      </p>
      <div className="team-award-grid league-award-grid">
        {league.awards.map((award) => {
          const mon = POKEMON_BY_ID.get(award.pokemonId);
          return (
            <article
              key={award.id}
              className={`team-award-card award-${award.id}`}
              aria-label={`${award.title} award`}
            >
              <span className="award-title">{award.title}</span>
              <div className="award-player">
                {mon && (
                  <span aria-hidden="true">
                    <Portrait mon={mon} />
                  </span>
                )}
                <div>
                  <strong>{name(award.pokemonId)}</strong>
                  <span>{teamName(award.teamId)}</span>
                  <span>{award.value}</span>
                </div>
              </div>
              <p>{award.description}</p>
              <details className="league-finalists">
                <summary>
                  Top {Math.min(3, award.finalists.length)} finalists
                </summary>
                <ol>
                  {award.finalists.slice(0, 3).map((p) => (
                    <li key={p.playerId}>
                      <strong>{name(p.pokemonId)}</strong>
                      <span>
                        {teamName(p.teamId)} · {p.value}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          );
        })}
      </div>
      <div className="league-honors">
        {[
          { title: "All-League", ids: league.allLeague },
          { title: "All-Defense", ids: league.allDefense },
        ].map((group) => (
          <section key={group.title} aria-label={group.title}>
            <span className="eyebrow">THE SELECT FIVE</span>
            <h4>{group.title}</h4>
            <ol>
              {group.ids.map((id) => {
                const p = league.players.find((p) => p.playerId === id);
                return p ? (
                  <li key={id}>
                    <PlayerName player={p} />
                  </li>
                ) : null;
              })}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}
const comparisonColumns: {
  label: string;
  value: (p: LeaguePlayer) => number | null;
  kind?: Column["kind"];
}[] = [
  { label: "Games played", value: (p) => p.gamesPlayed, kind: "count" },
  { label: "Games started", value: (p) => p.gamesStarted, kind: "count" },
  { label: "Minutes per game", value: (p) => perGame(p, p.minutes) },
  { label: "Points per game", value: (p) => perGame(p, p.points) },
  { label: "Rebounds per game", value: (p) => perGame(p, rebounds(p)) },
  { label: "Assists per game", value: (p) => perGame(p, p.assists) },
  { label: "Steals per game", value: (p) => perGame(p, p.steals) },
  { label: "Blocks per game", value: (p) => perGame(p, p.blocks) },
  { label: "Turnovers per game", value: (p) => perGame(p, p.turnovers) },
  ...columns
    .filter((c) => c.kind === "percentage" || c.kind === "ratio")
    .map((c) => ({ label: c.label, value: c.value, kind: c.kind })),
  { label: "Season +/−", value: (p) => p.plusMinus, kind: "count" },
];
function Comparison({ league }: { league: LeagueResult }) {
  const [first, setFirst] = useState(league.players[0]?.playerId ?? ""),
    [second, setSecond] = useState(
      league.players.find((p) => p.teamId !== league.players[0]?.teamId)
        ?.playerId ??
        league.players[1]?.playerId ??
        "",
    );
  const a = league.players.find((p) => p.playerId === first),
    b = league.players.find((p) => p.playerId === second);
  const ordered = [...league.players].sort((a, b) =>
    playerLabel(a).localeCompare(playerLabel(b)),
  );
  return (
    <section>
      <h4>Two players. One view.</h4>
      <div className="league-controls league-comparison-controls">
        {[
          { label: "First player", value: first, change: setFirst },
          { label: "Second player", value: second, change: setSecond },
        ].map((control) => (
          <label className="league-field" key={control.label}>
            {control.label}
            <select
              value={control.value}
              onChange={(e) => control.change(e.target.value)}
            >
              {ordered.map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {playerLabel(p)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {a && b && (
        <div
          className="results-table-wrap"
          role="region"
          tabIndex={0}
          aria-label="Scrollable player comparison"
        >
          <table className="results-table league-comparison">
            <caption className="sr-only">Player comparison</caption>
            <thead>
              <tr>
                <th scope="col">STATISTIC</th>
                <th scope="col">{playerLabel(a)}</th>
                <th scope="col">{playerLabel(b)}</th>
              </tr>
            </thead>
            <tbody>
              {comparisonColumns.map((c) => (
                <tr key={c.label}>
                  <th scope="row">{c.label}</th>
                  <td>{formatted(c.value(a), c.kind)}</td>
                  <td>{formatted(c.value(b), c.kind)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function Games({
  league,
  onGame,
}: {
  league: LeagueResult;
  onGame: (game: LeagueGameSummary) => void;
}) {
  const [team, setTeam] = useState("all"),
    [round, setRound] = useState("all"),
    [page, setPage] = useState(0);
  const games = league.games.filter(
    (g) =>
      (team === "all" ||
        g.homeTeamId === Number(team) ||
        g.awayTeamId === Number(team)) &&
      (round === "all" || g.round === Number(round)),
  );
  const rounds = [...new Set(league.games.map((g) => g.round))].sort(
      (a, b) => a - b,
    ),
    size = 30;
  const teamName = (id: number) =>
    league.teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  return (
    <section>
      <h4>Around the league</h4>
      <div className="league-controls">
        <TeamSelect
          teams={league.teams}
          value={team}
          onChange={(value) => {
            setTeam(value);
            setPage(0);
          }}
          label="Filter games by team"
        />
        <label className="league-field">
          Filter games by round
          <select
            value={round}
            onChange={(e) => {
              setRound(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All rounds</option>
            {rounds.map((r) => (
              <option key={r} value={r}>
                Round {r + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable league game results"
      >
        <table className="results-table league-games">
          <caption className="sr-only">League game results</caption>
          <thead>
            <tr>
              <th scope="col">AWAY / HOME</th>
              <th scope="col">ROUND</th>
              <th scope="col">FINAL</th>
            </tr>
          </thead>
          <tbody>
            {games.slice(page * size, (page + 1) * size).map((g) => (
              <tr key={g.id}>
                <th scope="row">
                  <span className="box-player-name">
                    {teamName(g.awayTeamId)}
                    <small>AT {teamName(g.homeTeamId)}</small>
                  </span>
                </th>
                <td>{g.round + 1}</td>
                <td>
                  <button
                    type="button"
                    className="game-score game-score-button"
                    onClick={() => onGame(g)}
                    aria-label={`View box score: ${teamName(g.awayTeamId)} at ${teamName(g.homeTeamId)}, ${g.awayScore} to ${g.homeScore}`}
                  >
                    {g.awayScore}–{g.homeScore}
                    {g.overtimePeriods > 0
                      ? ` ${g.overtimePeriods > 1 ? g.overtimePeriods : ""}OT`
                      : ""}
                    <span aria-hidden="true" className="box-score-link-icon">
                      ↗
                    </span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!games.length && (
        <p className="league-empty">No games match these filters.</p>
      )}
      <div className="league-pagination">
        <span role="status">
          {games.length
            ? `${page * size + 1}–${Math.min((page + 1) * size, games.length)}`
            : "0"}{" "}
          of {games.length} games
        </span>
        <button
          className="button secondary"
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous games
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={(page + 1) * size >= games.length}
          onClick={() => setPage((p) => p + 1)}
        >
          Next games
        </button>
      </div>
    </section>
  );
}
const sections = [
  "Standings",
  "Player leaders",
  "Team rosters",
  "League games",
  "Compare players",
  "Awards",
] as const;
export function LeaguePanel({ league }: { league: LeagueResult }) {
  const [section, setSection] =
      useState<(typeof sections)[number]>("Standings"),
    [teamId, setTeamId] = useState("0"),
    [game, setGame] = useState<LeagueGameSummary | null>(null);
  const id = useId();
  return (
    <section className="league-panel" aria-labelledby={`${id}-title`}>
      <div className="results-section-heading">
        <div>
          <span className="eyebrow">THE WHOLE LEAGUE</span>
          <h3 id={`${id}-title`}>
            {league.teams.length} teams. One basketball world.
          </h3>
          <p>
            {league.players.length} unique players ·{" "}
            {league.games.length.toLocaleString("en-US")} games · Every
            contribution counted.
          </p>
        </div>
      </div>
      <div className="league-navigation" role="group" aria-label="League views">
        {sections.map((label) => (
          <button
            type="button"
            key={label}
            aria-pressed={section === label}
            aria-controls={`${id}-content`}
            onClick={() => setSection(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <div id={`${id}-content`} className="league-view">
        {section === "Standings" && (
          <Standings
            league={league}
            onTeam={(id) => {
              setTeamId(String(id));
              setSection("Team rosters");
            }}
          />
        )}
        {section === "Player leaders" && <Leaders league={league} />}
        {section === "Team rosters" && (
          <Rosters league={league} teamId={teamId} setTeamId={setTeamId} />
        )}
        {section === "League games" && (
          <Games league={league} onGame={setGame} />
        )}
        {section === "Compare players" && <Comparison league={league} />}
        {section === "Awards" && <Awards league={league} />}
      </div>
      {game && (
        <LeagueBoxScore
          game={game}
          teams={league.teams}
          onClose={() => setGame(null)}
        />
      )}
    </section>
  );
}
