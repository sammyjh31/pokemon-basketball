import { useMemo, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { careerPlayers } from "../game/franchise";
import type { CareerTotals, Franchise } from "../game/franchiseTypes";
import {
  attributes,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_KEYS,
  DETAILED_ATTRIBUTE_KEYS,
  bestPosition,
  positionRating,
} from "../game/ratings";
import type { DevelopmentRatings } from "../game/developmentTypes";
import type { LeaguePlayer, Run } from "../game/types";
import { FranchiseDetailDialog } from "./FranchiseDetailDialog";

const average = (total: number, games: number) =>
  games ? (total / games).toFixed(1) : "—";
const percentage = (made: number, attempts: number) =>
  attempts ? `${((100 * made) / attempts).toFixed(1)}%` : "—";
const count = (total: number, games: number, totals: boolean) =>
  totals
    ? total.toLocaleString("en-US", { maximumFractionDigits: 1 })
    : average(total, games);
const per36 = (total: number, minutes: number) =>
  minutes ? ((total * 36) / minutes).toFixed(1) : "—";
function defenseCells(row: CareerTotals, totals: boolean) {
  return [
    row.gamesPlayed,
    ...[
      row.minutes,
      row.defensiveRebounds,
      row.steals,
      row.blocks,
      row.steals + row.blocks,
      row.fouls,
    ].map((value) => count(value, row.gamesPlayed, totals)),
    per36(row.defensiveRebounds, row.minutes),
    per36(row.steals, row.minutes),
    per36(row.blocks, row.minutes),
  ];
}
const defenseHeaders = [
  "GP",
  "MIN",
  "DREB",
  "STL",
  "BLK",
  "STL+BLK",
  "PF",
  "DREB/36",
  "STL/36",
  "BLK/36",
];
function statCells(row: CareerTotals, totals: boolean) {
  return [
    row.gamesPlayed,
    row.gamesStarted,
    count(row.minutes, row.gamesPlayed, totals),
    count(row.points, row.gamesPlayed, totals),
    count(
      row.offensiveRebounds + row.defensiveRebounds,
      row.gamesPlayed,
      totals,
    ),
    count(row.assists, row.gamesPlayed, totals),
    count(row.steals, row.gamesPlayed, totals),
    count(row.blocks, row.gamesPlayed, totals),
    count(row.turnovers, row.gamesPlayed, totals),
    count(row.plusMinus, row.gamesPlayed, totals),
    percentage(row.fgm, row.fga),
    percentage(row.threePM, row.threePA),
    percentage(row.ftm, row.fta),
    row.highPoints,
    row.doubleDoubles,
    row.tripleDoubles,
    row.playerOfGame,
  ];
}
const statHeaders = [
  "GP",
  "GS",
  "MIN",
  "PTS",
  "REB",
  "AST",
  "STL",
  "BLK",
  "TOV",
  "+/−",
  "FG%",
  "3P%",
  "FT%",
  "HIGH",
  "DD",
  "TD",
  "POG",
];
export function CareerDetail({
  pokemonId,
  franchise,
  run,
  onClose,
}: {
  pokemonId: number;
  franchise: Franchise;
  run: Run;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"regular" | "playoffs">("regular");
  const [defense, setDefense] = useState(false),
    [totals, setTotals] = useState(false);
  const headers = defense ? defenseHeaders : statHeaders;
  const cells = (row: CareerTotals) =>
    defense ? defenseCells(row, totals) : statCells(row, totals);
  const pokemon = POKEMON_BY_ID.get(pokemonId)!,
    team = franchise.teams.find((team) =>
      Object.values(team.roster).includes(pokemonId),
    );
  const career = useMemo(
    () =>
      careerPlayers(franchise, run).find(
        (player) => player.pokemonId === pokemonId,
      ),
    [franchise, run, pokemonId],
  );
  const lastDevelopment =
    team?.development?.[pokemonId] ??
    (franchise.offseasons ?? []).reduce<DevelopmentRatings>(
      (offsets, report) => {
        const changes =
          report.players.find((player) => player.pokemonId === pokemonId)
            ?.changes ?? {};
        for (const [key, value] of Object.entries(changes)) {
          const skill = key as keyof DevelopmentRatings;
          offsets[skill] = (offsets[skill] ?? 0) + value;
        }
        return offsets;
      },
      {},
    );
  const skills = attributes(pokemon, lastDevelopment);
  const best = bestPosition(pokemon, lastDevelopment);
  const current = run.result ?? run.seasonProgress?.result;
  const currentPlayer =
    franchise.phase === "season"
      ? (phase === "regular"
          ? current?.league?.players
          : run.playoffs?.players
        )?.find((player) => player.pokemonId === pokemonId)
      : undefined;
  const rows: {
    year: number;
    teamId: number;
    player?: LeaguePlayer;
    unavailable?: boolean;
    live?: boolean;
  }[] = franchise.history
    .map((season) => ({
      year: season.year,
      teamId: season.rosters.findIndex((roster) => roster.includes(pokemonId)),
      player: (phase === "regular"
        ? season.replay?.regularPlayers
        : season.replay?.playoffPlayers
      )?.find((player) => player.pokemonId === pokemonId),
      unavailable: !season.replay,
    }))
    .filter((row) => row.teamId >= 0);
  if (franchise.phase === "season" && team)
    rows.push({
      year: franchise.year,
      teamId: currentPlayer?.teamId ?? team?.id ?? 0,
      player: currentPlayer,
      live: true,
    });
  const honors = franchise.history.flatMap((season) => {
    const names = season.awards
      .filter((award) => award.pokemonId === pokemonId)
      .map((award) => award.title);
    if (season.allLeague.some((player) => player.pokemonId === pokemonId))
      names.push("All-League");
    if (season.allDefense.some((player) => player.pokemonId === pokemonId))
      names.push("All-Defense");
    if (season.finalsMvp.pokemonId === pokemonId) names.push("Finals MVP");
    if (season.rosters[season.championId].includes(pokemonId))
      names.push("Champion · championship ring");
    return names.map((name) => ({ year: season.year, name }));
  });
  if (franchise.phase === "season") {
    for (const award of current?.league?.awards ?? [])
      if (award.pokemonId === pokemonId)
        honors.push({ year: franchise.year, name: award.title });
    if (current?.league?.allLeague.some((id) => id.endsWith(`:${pokemonId}`)))
      honors.push({ year: franchise.year, name: "All-League" });
    if (current?.league?.allDefense.some((id) => id.endsWith(`:${pokemonId}`)))
      honors.push({ year: franchise.year, name: "All-Defense" });
    if (run.playoffs?.finalsMvp?.pokemonId === pokemonId)
      honors.push({ year: franchise.year, name: "Finals MVP" });
    if (
      run.playoffs?.championId !== null &&
      run.playoffs?.championId !== undefined &&
      current?.league?.teams[run.playoffs.championId].roster &&
      Object.values(
        current.league.teams[run.playoffs.championId].roster,
      ).includes(pokemonId)
    )
      honors.push({
        year: franchise.year,
        name: "Champion · championship ring",
      });
  }
  const development = (franchise.offseasons ?? []).flatMap((report) => {
    const player = report.players.find(
      (player) => player.pokemonId === pokemonId,
    );
    return player ? [{ year: report.year, ...player }] : [];
  });
  return (
    <FranchiseDetailDialog
      title={`${pokemon.name} career`}
      eyebrow={`#${String(pokemonId).padStart(3, "0")} · ${team?.name ?? "Released"}`}
      onClose={onClose}
    >
      <div className="career-profile">
        <strong>
          {positionRating(pokemon, best, lastDevelopment).toFixed(1)}{" "}
          <small>BEST RATING · {best}</small>
        </strong>
        <p>
          {career?.seasons ?? 0} seasons ·{" "}
          {
            honors.filter((honor) => honor.name.includes("championship ring"))
              .length
          }{" "}
          rings
        </p>
      </div>
      <div className="franchise-detail-tabs" aria-label="Career competition">
        <button
          type="button"
          aria-pressed={phase === "regular"}
          onClick={() => setPhase("regular")}
        >
          Regular season
        </button>
        <button
          type="button"
          aria-pressed={phase === "playoffs"}
          onClick={() => setPhase("playoffs")}
        >
          Playoffs
        </button>
      </div>
      <div className="stat-mode" role="group" aria-label="Player stat category">
        <button
          type="button"
          aria-pressed={!defense}
          onClick={() => setDefense(false)}
        >
          All stats
        </button>
        <button
          type="button"
          aria-pressed={defense}
          onClick={() => setDefense(true)}
        >
          Defense
        </button>
      </div>
      <div
        className="stat-mode"
        role="group"
        aria-label="Player statistics display"
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
      {defense && (
        <p>
          Stocks (STL+BLK) are steals plus blocks. DREB/36, STL/36 and BLK/36
          are per 36 minutes in both display modes; no minutes means no rate.
        </p>
      )}
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable season career statistics"
      >
        <table className="results-table career-season-table">
          <caption>
            {phase === "regular" ? "Regular-season" : "Playoff"} season rows ·
            {defense ? " Defense · " : " "}
            {totals ? "Totals" : "Per game"}
            {defense
              ? "; /36 columns remain rates"
              : "; GP, GS, HIGH, DD, TD and POG are counts; shooting percentages remain rates"}
          </caption>
          <thead>
            <tr>
              {["YEAR", "CLUB", ...headers].map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year}>
                <th scope="row">
                  {row.year}
                  {row.live ? " · LIVE" : ""}
                </th>
                <td>{franchise.teams[row.teamId]?.name ?? "—"}</td>
                {row.player ? (
                  cells(row.player).map((value, index) => (
                    <td key={index}>{value}</td>
                  ))
                ) : (
                  <td colSpan={headers.length} className="career-unavailable">
                    {row.unavailable
                      ? "Season detail unavailable · retained in career totals"
                      : row.live
                        ? "No appearances yet"
                        : "Did not qualify"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {career && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  Career
                </th>
                {cells(career[phase]).map((value, index) => (
                  <td key={index}>{value}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <section>
        <h3>{team ? "Current skills" : "Skills at release"}</h3>
        <dl className="career-skills">
          {[...ATTRIBUTE_KEYS, ...DETAILED_ATTRIBUTE_KEYS].map((key) => (
            <div key={key}>
              <dt>{ATTRIBUTE_LABELS[key]}</dt>
              <dd>{skills[key].toFixed(1)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3>Rating trajectory</h3>
        {development.length ? (
          <div
            className="results-table-wrap"
            role="region"
            tabIndex={0}
            aria-label="Scrollable player development"
          >
            <table className="results-table">
              <thead>
                <tr>
                  <th scope="col">OFFSEASON</th>
                  <th scope="col">BEFORE</th>
                  <th scope="col">AFTER</th>
                  <th scope="col">CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {development.map((row) => (
                  <tr key={row.year}>
                    <th scope="row">Year {row.year}</th>
                    <td>{row.before.toFixed(1)}</td>
                    <td>{row.after.toFixed(1)}</td>
                    <td>
                      {row.after - row.before > 0 ? "+" : ""}
                      {(row.after - row.before).toFixed(1)} · {row.outcome}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="career-unavailable">
            No saved development reports yet.
          </p>
        )}
      </section>
      <section>
        <h3>Honors & rings</h3>
        {honors.length ? (
          <ul className="career-honors">
            {honors.map((honor, index) => (
              <li key={`${honor.year}-${index}`}>
                <span>YEAR {honor.year}</span>
                {honor.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="career-unavailable">No honors recorded yet.</p>
        )}
      </section>
    </FranchiseDetailDialog>
  );
}
