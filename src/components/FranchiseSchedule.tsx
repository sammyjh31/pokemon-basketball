import { useMemo, useState } from "react";
import { leagueSchedule } from "../game/league";
import { nextFranchiseFixture } from "../game/interactiveSeason";
import { seasonTeams } from "../game/season";
import type { LeagueGameSummary, Run } from "../game/types";
import { LeagueBoxScore } from "./LeagueBoxScore";
import { LeaguePanel } from "./LeaguePanel";
import "../franchiseGames.css";

export function FranchiseSchedule({
  run,
  year,
  busy,
  progress,
  onPlay,
  onAdvance,
}: {
  run: Run;
  year: number;
  busy: boolean;
  progress: { completed: number; total: number };
  onPlay: () => void;
  onAdvance: (rounds: number) => void;
}) {
  const teams = useMemo(() => seasonTeams(run), [run]);
  const fixture = nextFranchiseFixture(run);
  const played = run.seasonProgress?.playedGames ?? {};
  const rounds = run.seasonProgress?.completedRounds ?? 0;
  const league = run.seasonProgress?.result?.league;
  const userStanding = league?.standings.find((t) => t.teamId === 0);
  const [game, setGame] = useState<LeagueGameSummary | null>(null);
  const schedule = useMemo(
    () =>
      leagueSchedule(run.seasonSeed).filter(
        (g) => g.homeTeamId === 0 || g.awayTeamId === 0,
      ),
    [run.seasonSeed],
  );
  const opponent = fixture
    ? teams.find(
        (t) =>
          t.id ===
          (fixture.homeTeamId === 0 ? fixture.awayTeamId : fixture.homeTeamId),
      )
    : undefined;
  const scores = new Map(league?.games.map((g) => [g.id, g]));
  return (
    <section
      id="season"
      className="season-panel franchise-schedule"
      aria-label="Franchise schedule"
    >
      <div className="franchise-fixture-heading">
        <div>
          <span className="eyebrow">YEAR {year} · REGULAR SEASON</span>
          <h2>Your next game.</h2>
          <p>
            {rounds} / 82 games complete · {userStanding?.wins ?? 0}–
            {userStanding?.losses ?? 0}
          </p>
        </div>
        <strong className="franchise-record">
          {userStanding?.wins ?? 0}
          <span>–</span>
          {userStanding?.losses ?? 0}
        </strong>
      </div>
      {fixture && (
        <div className="franchise-next-game">
          <span className="eyebrow">
            GAME {rounds + 1} · {fixture.homeTeamId === 0 ? "HOME" : "AWAY"}
          </span>
          <h3>
            {fixture.homeTeamId === 0 ? "vs." : "at"} {opponent?.name}
          </h3>
          <p>
            Play four 60-second quarters. Scores and counting stats scale ×12
            into an official 48-minute game. CPU games advance with yours.
          </p>
        </div>
      )}
      <div className="franchise-game-actions">
        <button
          className="button primary"
          disabled={busy || !fixture}
          onClick={onPlay}
        >
          Play next game
        </button>
        <button
          className="button"
          disabled={busy || !fixture}
          onClick={() => onAdvance(1)}
        >
          Simulate next game
        </button>
        <button
          className="button"
          disabled={busy || !fixture}
          onClick={() => onAdvance(82)}
        >
          Simulate remaining season
        </button>
      </div>
      {busy && (
        <div className="league-simulation-progress" role="status">
          <span>
            Updating the league · {progress.completed} / {progress.total} games
          </span>
          <progress
            aria-label="Season advancement"
            value={progress.completed}
            max={progress.total}
          />
        </div>
      )}
      <p className="schedule-hint">
        Set your lineup and minutes before Game 1. They stay fixed for this
        season’s simulations; you can substitute during games you play.
      </p>
      <details className="franchise-schedule-list">
        <summary>82-game schedule and box scores</summary>
        <ol>
          {schedule.map((fixture, index) => {
            const result = scores.get(fixture.id),
              home = fixture.homeTeamId === 0;
            const opponent = teams.find(
              (t) => t.id === (home ? fixture.awayTeamId : fixture.homeTeamId),
            )!;
            return (
              <li key={fixture.id}>
                <span>
                  {index + 1}. {home ? "vs." : "at"} {opponent.name}
                </span>
                {result ? (
                  <button
                    className="text-button"
                    onClick={() => setGame(result)}
                    aria-label={`Game ${index + 1} box score against ${opponent.name}`}
                  >
                    {home ? result.homeScore : result.awayScore}–
                    {home ? result.awayScore : result.homeScore} ·{" "}
                    {played[fixture.id] ? "Played" : "Simulated"}
                  </button>
                ) : (
                  <span>{index === rounds ? "Up next" : "Scheduled"}</span>
                )}
              </li>
            );
          })}
        </ol>
      </details>
      {league && <LeaguePanel league={league} playedGames={played} />}
      {game && (
        <LeagueBoxScore
          game={game}
          teams={teams}
          match={played[game.id]?.match}
          contextLabel={`Year ${year} · ${played[game.id] ? "Played" : "Simulated"}`}
          onClose={() => setGame(null)}
        />
      )}
    </section>
  );
}
