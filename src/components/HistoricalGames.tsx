import { useEffect, useState } from "react";
import { replayArchivedSeason, resolveArchivedMatch } from "../game/archive";
import type { FranchiseSeason } from "../game/franchiseTypes";
import type { LeagueGameSummary, SeasonResult } from "../game/types";
import { FranchiseDetailDialog } from "./FranchiseDetailDialog";
import { LeagueBoxScore } from "./LeagueBoxScore";

export function HistoricalGames({
  season,
  onClose,
}: {
  season: FranchiseSeason;
  onClose: () => void;
}) {
  const [result, setResult] = useState<SeasonResult | null>(null),
    [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"regular" | "playoffs">("regular"),
    [teamId, setTeamId] = useState("0");
  const [selected, setSelected] = useState<LeagueGameSummary | null>(null),
    [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!season.replay) return;
    const controller = new AbortController();
    setResult(null);
    setError(null);
    setSelected(null);
    setProgress(0);
    replayArchivedSeason(
      season,
      (completed, total) => setProgress(Math.round((completed / total) * 100)),
      controller.signal,
    )
      .then(setResult)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "The archived games could not be replayed.",
          );
      });
    return () => controller.abort();
  }, [season]);
  const teams = season.replay?.teams ?? [];
  const games = (
    phase === "regular"
      ? (result?.league?.games ?? [])
      : (season.replay?.playoffs.series.flatMap((series) => series.games) ?? [])
  ).filter(
    (game) =>
      teamId === "all" ||
      game.homeTeamId === Number(teamId) ||
      game.awayTeamId === Number(teamId),
  );
  const context = (game: LeagueGameSummary) =>
    phase === "regular"
      ? `YEAR ${season.year} · ROUND ${game.round + 1}`
      : `YEAR ${season.year} · PLAYOFFS · ROUND ${game.round + 1}`;
  return (
    <>
      <FranchiseDetailDialog
        title={`Year ${season.year} game archive`}
        eyebrow="FRANCHISE HISTORY"
        onClose={onClose}
        covered={!!selected}
      >
        {!season.replay ? (
          <p className="career-unavailable">
            Detailed game history is unavailable for this older season. Its
            standings, career totals, awards and championship remain saved.
          </p>
        ) : (
          <>
            <div className="historical-controls">
              <div
                className="franchise-detail-tabs"
                aria-label="Historical competition"
              >
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
              <label>
                Club
                <select
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                >
                  <option value="all">All clubs</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && <p role="alert">{error}</p>}
            {!result && !error && phase === "regular" && (
              <p role="status">Replaying frozen season inputs… {progress}%</p>
            )}
            {(result || phase === "playoffs") && (
              <>
                <p className="career-unavailable">
                  {games.length} games · Archived rosters and skills · Played
                  games retain official results.
                </p>
                <ol className="historical-games">
                  {games.map((game) => {
                    const played =
                      phase === "regular"
                        ? season.replay!.playedGames[game.id]
                        : season.replay!.playoffs.playedGames?.[game.id];
                    return (
                      <li key={game.id}>
                        <span className="historical-game-round">
                          {phase === "regular"
                            ? `R${game.round + 1}`
                            : `PLAYOFF R${game.round + 1}`}
                          {played && <small>PLAYED</small>}
                        </span>
                        <span className="historical-game-clubs">
                          {teams[game.awayTeamId].name}
                          <small>at {teams[game.homeTeamId].name}</small>
                        </span>
                        <strong>
                          {game.awayScore}–{game.homeScore}
                          {game.overtimePeriods > 0
                            ? ` · ${game.overtimePeriods}OT`
                            : ""}
                        </strong>
                        <button
                          type="button"
                          onClick={() => setSelected(game)}
                          aria-label={`View box: ${teams[game.awayTeamId].name} at ${teams[game.homeTeamId].name}, ${context(game)}`}
                        >
                          View box
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </>
        )}
      </FranchiseDetailDialog>
      {selected && (
        <LeagueBoxScore
          game={selected}
          teams={teams}
          match={resolveArchivedMatch(season, selected, phase)}
          contextLabel={context(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
