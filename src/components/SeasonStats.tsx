import { AbilityStats } from "./AbilityStats";
import { useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import type { SeasonAward, SeasonPlayer } from "../game/types";
import { Portrait } from "./Portrait";
import { PlayerSpotlights, StatExplorer } from "./ResultsVisuals";

type StatColumn = {
  key: string;
  label: string;
  title: string;
  value: (player: SeasonPlayer) => number | null;
  format?: "count" | "percentage";
};
const percentage = (made: number, attempted: number) =>
  attempted > 0 ? (made / attempted) * 100 : null;
const columns: StatColumn[] = [
  { key: "pts", label: "PTS", title: "points", value: (p) => p.points },
  {
    key: "reb",
    label: "REB",
    title: "rebounds",
    value: (p) => p.offensiveRebounds + p.defensiveRebounds,
  },
  { key: "ast", label: "AST", title: "assists", value: (p) => p.assists },
  {
    key: "gp",
    label: "GP",
    title: "games played",
    value: (p) => p.gamesPlayed,
    format: "count",
  },
  {
    key: "gs",
    label: "GS",
    title: "games started",
    value: (p) => p.gamesStarted,
    format: "count",
  },
  { key: "min", label: "MIN", title: "minutes", value: (p) => p.minutes },
  { key: "stl", label: "STL", title: "steals", value: (p) => p.steals },
  { key: "blk", label: "BLK", title: "blocks", value: (p) => p.blocks },
  { key: "tov", label: "TOV", title: "turnovers", value: (p) => p.turnovers },
  {
    key: "fg",
    label: "FG%",
    title: "field goal percentage",
    value: (p) => percentage(p.fgm, p.fga),
    format: "percentage",
  },
  {
    key: "three",
    label: "3P%",
    title: "three point percentage",
    value: (p) => percentage(p.threePM, p.threePA),
    format: "percentage",
  },
  {
    key: "ft",
    label: "FT%",
    title: "free throw percentage",
    value: (p) => percentage(p.ftm, p.fta),
    format: "percentage",
  },
  {
    key: "ts",
    label: "TS%",
    title: "true shooting percentage",
    value: (p) => percentage(p.points, 2 * (p.fga + 0.44 * p.fta)),
    format: "percentage",
  },
  {
    key: "high",
    label: "HIGH",
    title: "single game scoring high",
    value: (p) => p.highPoints,
    format: "count",
  },
  {
    key: "dd",
    label: "DD",
    title: "double doubles",
    value: (p) => p.doubleDoubles,
    format: "count",
  },
  {
    key: "td",
    label: "TD",
    title: "triple doubles",
    value: (p) => p.tripleDoubles,
    format: "count",
  },
];

export function SeasonStats({
  players,
  awards = [],
}: {
  players: SeasonPlayer[];
  awards?: SeasonAward[];
}) {
  const [mode, setMode] = useState<"per-game" | "totals">("per-game");
  const [sort, setSort] = useState({ key: "pts", descending: true });
  const statValue = (player: SeasonPlayer, column: StatColumn) => {
    const value = column.value(player);
    if (value === null || column.format || mode === "totals") return value;
    return player.gamesPlayed > 0 ? value / player.gamesPlayed : null;
  };
  const sortColumn = columns.find((column) => column.key === sort.key)!;
  const sorted = [...players].sort((a, b) => {
    const aValue = statValue(a, sortColumn),
      bValue = statValue(b, sortColumn);
    if (aValue === null && bValue !== null) return 1;
    if (bValue === null && aValue !== null) return -1;
    return (
      ((aValue ?? 0) - (bValue ?? 0)) * (sort.descending ? -1 : 1) ||
      a.pokemonId - b.pokemonId
    );
  });
  const format = (player: SeasonPlayer, column: StatColumn) => {
    const value = statValue(player, column);
    if (value === null) return "—";
    if (column.format === "percentage") return `${value.toFixed(1)}%`;
    if (column.format === "count" || mode === "totals")
      return value.toLocaleString("en-US");
    return value.toFixed(1);
  };
  return (
    <div className="season-results-detail">
      <section
        className="player-stat-section"
        aria-labelledby="player-stats-title"
      >
        <div className="results-section-heading">
          <div>
            <span className="eyebrow">EIGHT PLAYERS. ONE TEAM.</span>
            <h3 id="player-stats-title">Season statistics</h3>
            <p>Five starters, three reserves. Every contribution counted.</p>
          </div>
          <div
            className="stat-mode"
            role="group"
            aria-label="Statistics display"
          >
            <button
              type="button"
              aria-pressed={mode === "per-game"}
              onClick={() => setMode("per-game")}
            >
              Per game
            </button>
            <button
              type="button"
              aria-pressed={mode === "totals"}
              onClick={() => setMode("totals")}
            >
              Totals
            </button>
          </div>
        </div>
        <StatExplorer
          scope="Team"
          options={columns.map((column) => ({
            key: column.key,
            label: column.title,
          }))}
          sort={sort}
          onChange={setSort}
        />
        <PlayerSpotlights
          label="Team player spotlights"
          statistic={sortColumn.title}
          mode={
            sortColumn.format === "percentage"
              ? "shooting percentage"
              : sortColumn.format === "count"
                ? "recorded value"
                : mode === "per-game"
                  ? "per game"
                  : "totals"
          }
          rows={sorted.flatMap((player) => {
            const value = statValue(player, sortColumn);
            return value === null
              ? []
              : [
                  {
                    key: player.pokemonId,
                    pokemonId: player.pokemonId,
                    subtitle: `${player.slot} · ${player.gamesPlayed} games`,
                    value,
                    formatted: format(player, sortColumn),
                  },
                ];
          })}
        />
        <p className="stats-scroll-hint">
          Scroll across for more stats. Select a column to sort.
        </p>
        <div
          className="results-table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Scrollable season player statistics"
        >
          <table className="results-table season-stats-table">
            <caption className="sr-only">
              Season player statistics —{" "}
              {mode === "per-game" ? "per game averages" : "season totals"}.
              Select a column to sort.
            </caption>
            <thead>
              <tr>
                <th scope="col">PLAYER</th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      sort.key === column.key
                        ? sort.descending
                          ? "descending"
                          : "ascending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      aria-label={`Sort by ${column.title}`}
                      title={column.title}
                      onClick={() =>
                        setSort((current) => ({
                          key: column.key,
                          descending:
                            current.key === column.key
                              ? !current.descending
                              : true,
                        }))
                      }
                    >
                      {column.label}
                      <span className="sort-direction" aria-hidden="true">
                        {sort.key === column.key
                          ? sort.descending
                            ? "↓"
                            : "↑"
                          : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((player) => {
                const mon = POKEMON_BY_ID.get(player.pokemonId);
                return (
                  <tr key={player.pokemonId}>
                    <th scope="row">
                      <span className="stat-player">
                        {mon && (
                          <span aria-hidden="true">
                            <Portrait mon={mon} />
                          </span>
                        )}
                        <span>
                          {mon?.name ?? `#${player.pokemonId}`}
                          <small>
                            {player.slot} ·{" "}
                            {player.slot.startsWith("B")
                              ? "RESERVE"
                              : "STARTER"}
                          </small>
                        </span>
                      </span>
                    </th>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={
                          sort.key === column.key ? "sorted-stat" : undefined
                        }
                      >
                        {format(player, column)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <details className="results-deep-dive">
          <summary>Abilities, physical effects & move usage</summary>
          <AbilityStats
            label="Season ability activations"
            rows={sorted.map((p) => ({
              key: p.pokemonId,
              label: POKEMON_BY_ID.get(p.pokemonId)?.name ?? `#${p.pokemonId}`,
              pokemonId: p.pokemonId,
              abilityActivations: p.abilityActivations,
            }))}
          />
        </details>
        <p className="stat-legend">
          GP / GS: games played / started · HIGH: most points in one game · DD /
          TD: double / triple doubles. Percentages use total attempts; — means
          no attempts. TS% = PTS ÷ [2 × (FGA + 0.44 × FTA)].
        </p>
      </section>
      {awards.length > 0 && (
        <section className="team-awards" aria-labelledby="team-awards-title">
          <div className="results-section-heading">
            <div>
              <span className="eyebrow">THE SEASON’S STANDOUTS</span>
              <h3 id="team-awards-title">Team awards</h3>
              <p>
                Honors within your roster, earned from this season’s production.
              </p>
            </div>
          </div>
          <div className="team-award-grid">
            {awards.map((award) => {
              const mon = POKEMON_BY_ID.get(award.pokemonId);
              return (
                <article
                  className={`team-award-card award-${award.id}`}
                  key={award.id}
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
                      <strong>{mon?.name ?? `#${award.pokemonId}`}</strong>
                      <span>{award.value}</span>
                    </div>
                  </div>
                  <p>{award.description}</p>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
