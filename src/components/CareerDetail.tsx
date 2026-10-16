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
import type { LeaguePlayer, Run } from "../game/types";
import { FranchiseDetailDialog } from "./FranchiseDetailDialog";

const average = (total: number, games: number) =>
  games ? (total / games).toFixed(1) : "—";
const percentage = (made: number, attempts: number) =>
  attempts ? `${((100 * made) / attempts).toFixed(1)}%` : "—";
function statCells(row: CareerTotals) {
  return [
    row.gamesPlayed,
    row.gamesStarted,
    average(row.minutes, row.gamesPlayed),
    average(row.points, row.gamesPlayed),
    average(row.offensiveRebounds + row.defensiveRebounds, row.gamesPlayed),
    average(row.assists, row.gamesPlayed),
    average(row.steals, row.gamesPlayed),
    average(row.blocks, row.gamesPlayed),
    average(row.turnovers, row.gamesPlayed),
    average(row.plusMinus, row.gamesPlayed),
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
  const skills = attributes(pokemon, team?.development?.[pokemonId]);
  const best = bestPosition(pokemon, team?.development?.[pokemonId]);
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
  }[] = franchise.history.map((season) => ({
    year: season.year,
    teamId: season.rosters.findIndex((roster) => roster.includes(pokemonId)),
    player: (phase === "regular"
      ? season.replay?.regularPlayers
      : season.replay?.playoffPlayers
    )?.find((player) => player.pokemonId === pokemonId),
    unavailable: !season.replay,
  }));
  if (franchise.phase === "season")
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
      eyebrow={`#${String(pokemonId).padStart(3, "0")} · ${team?.name ?? "Franchise player"}`}
      onClose={onClose}
    >
      <div className="career-profile">
        <strong>
          {positionRating(
            pokemon,
            best,
            team?.development?.[pokemonId],
          ).toFixed(1)}{" "}
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
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable season career statistics"
      >
        <table className="results-table career-season-table">
          <caption>
            {phase === "regular" ? "Regular-season" : "Playoff"} season rows ·
            MIN, PTS, REB, AST, STL, BLK, TOV and +/− per game; DD, TD and POG
            are totals
          </caption>
          <thead>
            <tr>
              {["YEAR", "CLUB", ...statHeaders].map((header) => (
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
                  statCells(row.player).map((value, index) => (
                    <td key={index}>{value}</td>
                  ))
                ) : (
                  <td
                    colSpan={statHeaders.length}
                    className="career-unavailable"
                  >
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
                {statCells(career[phase]).map((value, index) => (
                  <td key={index}>{value}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <section>
        <h3>Current skills</h3>
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
