import type { CSSProperties } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { POSITIONS, type LeagueTeam, type Roster } from "../game/types";
import { Portrait, TYPE_COLORS } from "./Portrait";
import "../resultsVisual.css";

type Spotlight = {
  key: string | number;
  pokemonId: number;
  subtitle: string;
  value: number;
  formatted: string;
};

/** Uses the table's already filtered and sorted rows, so both views agree. */
export function PlayerSpotlights({
  rows,
  label,
  statistic,
  mode,
}: {
  rows: Spotlight[];
  label: string;
  statistic: string;
  mode: string;
}) {
  if (!rows.length) return null;
  const minimum = Math.min(0, ...rows.map((row) => row.value));
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="player-spotlights" aria-label={label}>
      <div className="spotlight-heading">
        <span className="eyebrow">ON THE LEADERBOARD</span>
        <span>
          {statistic} · {mode} · current sort
        </span>
      </div>
      <div className="player-spotlight-grid">
        {rows.slice(0, 3).map((row, index) => {
          const mon = POKEMON_BY_ID.get(row.pokemonId);
          return (
            <article
              key={row.key}
              className="player-spotlight"
              style={
                {
                  "--spot-color": TYPE_COLORS[mon?.types[0] ?? "water"],
                } as CSSProperties
              }
            >
              <span className="spotlight-rank">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="spotlight-portrait">
                {mon && <Portrait mon={mon} />}
              </div>
              <div className="spotlight-player">
                <h4>{mon?.name ?? `#${row.pokemonId}`}</h4>
                <p>{row.subtitle}</p>
              </div>
              <div
                className={`spotlight-value${row.formatted.length > 5 ? " is-long" : ""}`}
              >
                <strong>{row.formatted}</strong>
                <span>{statistic}</span>
              </div>
              <meter
                min={minimum}
                max={maximum}
                value={row.value}
                aria-label={`${mon?.name ?? row.pokemonId} ${statistic}`}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function TeamArtwork({
  roster,
  compact = false,
}: {
  roster?: Roster;
  compact?: boolean;
}) {
  if (!roster) return <span className="team-art-pending">To be decided</span>;
  const ids = POSITIONS.flatMap((slot) =>
    roster[slot] == null ? [] : [roster[slot]!],
  ).slice(0, compact ? 1 : 3);
  return (
    <span className={`team-artwork${compact ? " is-compact" : ""}`}>
      {ids.map((id) => {
        const mon = POKEMON_BY_ID.get(id);
        return mon ? <Portrait mon={mon} key={id} /> : null;
      })}
    </span>
  );
}

export function SeriesMatchup({
  sides,
  winsNeeded,
}: {
  sides: { team?: LeagueTeam; seed?: number; wins: number; winner: boolean }[];
  winsNeeded: number;
}) {
  return (
    <section className="series-matchup" aria-label="Series matchup">
      {sides.map(({ team, seed, wins, winner }, index) => (
        <div
          className={`series-contender${winner ? " is-winner" : ""}`}
          key={index}
        >
          <span className="series-contender-seed">
            {team ? `SEED ${seed ?? "—"}` : "NEXT ROUND"}
            {winner ? " · ADVANCES" : ""}
          </span>
          <TeamArtwork roster={team?.roster} />
          <strong className="series-contender-name">
            {team?.name ?? "Awaiting winner"}
          </strong>
          {team && (
            <div
              className="series-win-track"
              aria-label={`${team.name}: ${wins} of ${winsNeeded} wins needed`}
            >
              <b>{wins}</b>
              <span className="series-win-pips" aria-hidden="true">
                {Array.from({ length: winsNeeded }, (_, i) => (
                  <i key={i} className={i < wins ? "is-won" : ""} />
                ))}
              </span>
              <small>of {winsNeeded} wins</small>
            </div>
          )}
        </div>
      ))}
      <span className="series-versus" aria-hidden="true">
        VS
      </span>
    </section>
  );
}

export function StatExplorer({
  scope,
  options,
  sort,
  onChange,
}: {
  scope: string;
  options: { key: string; label: string }[];
  sort: { key: string; descending: boolean };
  onChange: (sort: { key: string; descending: boolean }) => void;
}) {
  return (
    <div
      className="stat-explorer"
      role="group"
      aria-label={`${scope} ranking controls`}
    >
      <label>
        <span>Rank players by</span>
        <select
          aria-label={`${scope} ranking statistic`}
          value={sort.key}
          onChange={(event) =>
            onChange({ key: event.target.value, descending: true })
          }
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label.charAt(0).toUpperCase() + option.label.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        aria-label={
          sort.descending ? "Show lowest first" : "Show highest first"
        }
        onClick={() => onChange({ ...sort, descending: !sort.descending })}
      >
        {sort.descending ? "Highest first ↓" : "Lowest first ↑"}
      </button>
    </div>
  );
}
