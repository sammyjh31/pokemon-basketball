import { useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { ATTRIBUTE_LABELS } from "../game/ratings";
import type {
  DevelopmentSkill,
  PlayerDevelopmentChange,
} from "../game/developmentTypes";
import type { Franchise, FranchiseTrade } from "../game/franchiseTypes";
import type { LeagueTeam } from "../game/types";
import { Portrait } from "./Portrait";
import "../offseason.css";

const playerName = (id: number) =>
  POKEMON_BY_ID.get(id)?.name ?? `Pokémon #${id}`;
const clubName = (teams: LeagueTeam[], id: number) =>
  teams.find((team) => team.id === id)?.name ?? `Team ${id}`;
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;

export function TradeActivity({
  trade,
  teams,
}: {
  trade: FranchiseTrade;
  teams: LeagueTeam[];
}) {
  const from = clubName(teams, trade.fromTeamId ?? 0);
  const to = clubName(teams, trade.teamId);
  return (
    <>
      <span>
        {from} sends {playerName(trade.giveId)} to {to}.
      </span>
      <span>
        {to} sends {playerName(trade.receiveId)} to {from}.
      </span>
      {trade.reason && <p>{trade.reason}</p>}
    </>
  );
}

function PlayerChange({
  player,
  teams,
}: {
  player: PlayerDevelopmentChange;
  teams: LeagueTeam[];
}) {
  const mon = POKEMON_BY_ID.get(player.pokemonId);
  const delta = player.after - player.before;
  const changes = Object.entries(player.changes).filter(
    ([, value]) => value !== 0,
  );
  return (
    <li>
      <details className="development-player">
        <summary>
          <span className="development-identity">
            {mon && (
              <span aria-hidden="true">
                <Portrait mon={mon} />
              </span>
            )}
            <span>
              <strong>{playerName(player.pokemonId)}</strong>
              <small>
                {clubName(teams, player.teamId)} · {player.outcome}
              </small>
            </span>
          </span>
          <span className="development-rating">
            <b>
              {player.before.toFixed(1)} → {player.after.toFixed(1)}
            </b>
            <small
              className={
                delta > 0
                  ? "development-gain"
                  : delta < 0
                    ? "development-loss"
                    : ""
              }
            >
              {signed(Number(delta.toFixed(1)))} rating
            </small>
          </span>
          <span className="development-detail-label">
            {playerName(player.pokemonId)} development details
          </span>
        </summary>
        <div className="development-detail">
          <p>
            {player.minutesPerGame.toFixed(1)} minutes per game ·{" "}
            {player.impactPer36.toFixed(1)} impact per 36 minutes
          </p>
          <ul
            className="development-skills"
            aria-label={`${playerName(player.pokemonId)} skill changes`}
          >
            {changes.map(([skill, change]) => (
              <li
                key={skill}
                className={
                  change! > 0 ? "development-gain" : "development-loss"
                }
              >
                {ATTRIBUTE_LABELS[skill as DevelopmentSkill]} {signed(change!)}
              </li>
            ))}
          </ul>
          {!changes.length && (
            <p>No individual skill changes this offseason.</p>
          )}
          <ul className="development-reasons">
            {player.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>
      </details>
    </li>
  );
}

export function OffseasonReport({ franchise }: { franchise: Franchise }) {
  const reports = [...(franchise.offseasons ?? [])].sort(
    (a, b) => b.year - a.year,
  );
  const [year, setYear] = useState(reports[0]?.year ?? franchise.year);
  const [team, setTeam] = useState("all");
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const report = reports.find((item) => item.year === year) ?? reports[0];
  if (!report)
    return (
      <section aria-label="Offseason development report">
        <h3>Development is still ahead.</h3>
        <p>
          Run offseason development from the Offseason tab after the Finals.
          Player changes and CPU activity will be saved here each year.
        </p>
      </section>
    );
  const players = report.players
    .filter(
      (player) =>
        (team === "all" || player.teamId === Number(team)) &&
        playerName(player.pokemonId)
          .toLowerCase()
          .includes(search.trim().toLowerCase()) &&
        (direction === "all" ||
          (direction === "gains"
            ? player.after > player.before
            : player.after < player.before)),
    )
    .sort(
      (a, b) =>
        b.after - b.before - (a.after - a.before) || a.pokemonId - b.pokemonId,
    );
  const trades = franchise.trades
    .slice(report.tradeStart, report.tradeStart + report.tradeCount)
    .filter((trade) => trade.source === "cpu");
  return (
    <section
      className="offseason-report"
      aria-label="Offseason development report"
    >
      <div className="franchise-section-heading">
        <div>
          <h3>A league in motion.</h3>
          <p>
            Year {report.year} development · Ratings show each player's best
            position. Team filters use the club they played for that season,
            before offseason trades.
          </p>
        </div>
      </div>
      <div
        className="development-summary"
        aria-label="League development summary"
      >
        <span>
          <b>{report.players.filter((p) => p.after > p.before).length}</b>{" "}
          improved
        </span>
        <span>
          <b>{report.players.filter((p) => p.after < p.before).length}</b>{" "}
          declined
        </span>
        <span>
          <b>{report.players.filter((p) => p.outcome === "breakout").length}</b>{" "}
          breakouts
        </span>
        <span>
          <b>{report.players.filter((p) => p.outcome === "slump").length}</b>{" "}
          slumps
        </span>
      </div>
      <div className="league-controls development-controls">
        <label className="league-field">
          Development year
          <select
            value={report.year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {reports.map((item) => (
              <option key={item.year} value={item.year}>
                Year {item.year}
              </option>
            ))}
          </select>
        </label>
        <label className="league-field">
          Filter development by last-season team
          <select
            value={team}
            onChange={(event) => setTeam(event.target.value)}
          >
            <option value="all">All teams</option>
            {franchise.teams.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="league-field">
          Search development players
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pokémon name"
          />
        </label>
        <label className="league-field">
          Rating movement
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          >
            <option value="all">All changes</option>
            <option value="gains">Rating gains</option>
            <option value="declines">Rating declines</option>
          </select>
        </label>
      </div>
      <p className="development-count" role="status">
        {players.length} of {report.players.length} players · Largest rating
        gains first
      </p>
      <ul
        className="development-list"
        aria-label={`Year ${report.year} player development`}
      >
        {players.map((player) => (
          <PlayerChange
            key={`${report.year}:${player.pokemonId}`}
            player={player}
            teams={franchise.teams}
          />
        ))}
      </ul>
      {!players.length && (
        <p className="league-empty">No players match these filters.</p>
      )}
      <section
        className="development-transactions"
        aria-label="CPU offseason transactions"
      >
        <h4>CPU club activity · Year {report.year}</h4>
        <p>Clubs exchange players when both rosters benefit.</p>
        {trades.length ? (
          <ol>
            {trades.map((trade, index) => (
              <li key={index}>
                <strong>
                  {clubName(franchise.teams, trade.fromTeamId!)} ⇄{" "}
                  {clubName(franchise.teams, trade.teamId)}
                </strong>
                <TradeActivity trade={trade} teams={franchise.teams} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="league-empty">
            No CPU trades met both clubs' needs this offseason.
          </p>
        )}
      </section>
    </section>
  );
}
