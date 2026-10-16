import { useEffect, useMemo, useState } from "react";
import { OPPONENTS, SCHEDULE } from "../data/opponents";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  ROSTER_SLOTS,
  TACTIC_LABELS,
  type GameResult,
  type Run,
  type TeamRatings,
} from "../game/types";
import { Portrait } from "./Portrait";
import { SeasonStats } from "./SeasonStats";
import { BoxScore } from "./BoxScore";
import { LeaguePanel } from "./LeaguePanel";
import { LeagueBoxScore } from "./LeagueBoxScore";
import { createLeague, leagueSchedule } from "../game/league";
export function SeasonPanel({
  run,
  ratings,
  animate,
  onSimulate,
  simulating = false,
  progress,
}: {
  run: Run;
  ratings: TeamRatings;
  animate: boolean;
  onSimulate: () => void;
  simulating?: boolean;
  progress?: { completed: number; total: number };
}) {
  const result = run.result;
  const reduced =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const [visible, setVisible] = useState(result && !animate ? 82 : 0);
  const [copyMessage, setCopyMessage] = useState(""),
    [copyFallback, setCopyFallback] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameResult | null>(null);
  useEffect(() => {
    setCopyMessage("");
    setCopyFallback(false);
    setSelectedGame(null);
  }, [run.id, result]);
  useEffect(() => {
    if (!result) {
      setVisible(0);
      return;
    }
    if (!animate || reduced) {
      setVisible(82);
      return;
    }
    setVisible(0);
    const timer = window.setInterval(
      () =>
        setVisible((n) => {
          if (n >= 81) {
            window.clearInterval(timer);
            return 82;
          }
          return n + 1;
        }),
      45,
    );
    return () => window.clearInterval(timer);
  }, [run.id, result, animate, reduced]);
  const showing = result?.games.slice(0, visible) ?? [],
    wins = showing.filter((g) => g.won).length,
    losses = showing.length - wins;
  const done = !!result && visible === 82;
  const league = result?.modelVersion === 3 ? result.league : undefined;
  const archived =
    !!result &&
    !league &&
    (result.modelVersion !== 2 || !result.playerStats?.length);
  const rosterFilled = ROSTER_SLOTS.filter(
    (slot) => run.roster[slot] != null,
  ).length;
  const ready = ratings.complete && rosterFilled === ROSTER_SLOTS.length;
  const previewTeams = useMemo(
    () => (!result && ready ? createLeague(run) : []),
    [run, result, ready],
  );
  const leagueTeams = league?.teams ?? previewTeams;
  const schedule = useMemo(
    () =>
      league
        ? result!.games
        : previewTeams.length
          ? leagueSchedule(run.seasonSeed)
              .filter((g) => g.homeTeamId === 0 || g.awayTeamId === 0)
              .map((g, index) => ({
                index,
                opponentId: g.homeTeamId === 0 ? g.awayTeamId : g.homeTeamId,
                home: g.homeTeamId === 0,
              }))
          : SCHEDULE,
    [league, result, previewTeams, run.seasonSeed],
  );
  const mvpAward = league?.awards.find((award) => award.id === "mvp");
  const mvp = result
    ? POKEMON_BY_ID.get(mvpAward?.pokemonId ?? result.mvpId)
    : null;
  const mvpTeam = leagueTeams.find((team) => team.id === mvpAward?.teamId);
  const selectedLeagueGame =
    selectedGame &&
    league?.games.find((game) => game.id === selectedGame.leagueGameId);
  const recap =
    done && result
      ? `82–0 Pokémon Basketball\n${result.wins}–${result.losses} · ${run.mode === "spin" ? "Spin & Pick" : "Free Draft"}\n${Object.entries(
          run.roster,
        )
          .filter(([, id]) => id != null)
          .map(([p, id]) => `${p}: ${POKEMON_BY_ID.get(id!)!.name}`)
          .join(
            " · ",
          )}\n${league ? "League MVP" : archived ? "MVP" : "Team MVP"}: ${mvp?.name}${mvpTeam ? ` · ${mvpTeam.name}` : ""}${!league && !archived && result.awards?.length ? `\nTeam awards: ${result.awards.map((award) => `${award.title} — ${POKEMON_BY_ID.get(award.pokemonId)?.name}`).join(" · ")}` : ""}`
      : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recap);
      setCopyMessage("Recap copied!");
      setCopyFallback(false);
    } catch {
      setCopyFallback(true);
      setCopyMessage("Select and copy your recap below.");
    }
  };
  return (
    <section
      className="season-panel"
      id="season"
      aria-labelledby="season-title"
    >
      <div className="season-heading">
        <div>
          <span className="eyebrow">THE ROAD TO 82–0</span>
          <h2 id="season-title">A season to remember.</h2>
          <p>
            {result
              ? done
                ? archived
                  ? "Your original season, preserved."
                  : league
                    ? "Thirty teams. Two hundred forty players. One shared season."
                    : "Eight players. Five on court. A season of contributions."
                : `Game ${visible} of 82. The story is unfolding…`
              : "Build an eight-player roster. Eighty-two games tell the story."}
          </p>
        </div>
        {!result ? (
          <button
            className="button primary simulate"
            onClick={onSimulate}
            disabled={!ready || simulating}
            aria-label="Simulate season"
          >
            {simulating ? "Simulating league…" : "Simulate season"}{" "}
            <svg
              className="arrow-icon"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 13 13 3M3 3h10v10"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        ) : !done ? (
          <button className="button secondary" onClick={() => setVisible(82)}>
            Skip reveal
          </button>
        ) : (
          <button className="button secondary" onClick={copy}>
            Copy recap{" "}
            <svg
              className="arrow-icon"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 13 13 3M3 3h10v10"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        )}
      </div>
      {simulating && (
        <div className="league-simulation-progress" role="status">
          <span>
            Simulating the league ·{" "}
            {(progress?.completed ?? 0).toLocaleString("en-US")} /{" "}
            {(progress?.total ?? 1230).toLocaleString("en-US")} games
          </span>
          <progress
            aria-label="League simulation progress"
            value={progress?.completed ?? 0}
            max={progress?.total ?? 1230}
          />
        </div>
      )}
      {!result && !ready ? (
        <div className="season-empty">
          <div className="empty-season-icon" aria-hidden="true">
            82
          </div>
          <div>
            <strong>Your season is waiting.</strong>
            <p>
              Fill five starting positions and three bench spots to tip things
              off.
            </p>
          </div>
          <div
            className="empty-progress"
            aria-label={`${rosterFilled} of 8 roster spots filled`}
          >
            {ROSTER_SLOTS.map((slot, i) => (
              <span className={i < rosterFilled ? "on" : ""} key={slot} />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="season-overview">
            <div className="season-record">
              <span className="eyebrow">
                {result ? "SEASON RECORD" : "TEAM RATING"}
              </span>
              <strong data-testid="season-record">
                {result
                  ? `${wins}–${losses}`
                  : `${ratings.overall.toFixed(1)}/100`}
              </strong>
              <span>
                {done
                  ? wins === 82
                    ? "THE PERFECT SEASON."
                    : `${Math.round((wins / 82) * 100)}% win rate · ${run.mode === "spin" ? "Spin & Pick" : "Free Draft"}`
                  : result
                    ? "One game at a time."
                    : "Rotation, role fit and coaching"}
              </span>
            </div>
            <div className="season-meta">
              <span className="eyebrow">
                {done
                  ? league
                    ? "LEAGUE MVP"
                    : archived
                      ? "SEASON MVP"
                      : "TEAM MVP"
                  : "THE CHALLENGE"}
              </span>
              {done && mvp ? (
                <div className="mvp">
                  <Portrait mon={mvp} />
                  <div>
                    <strong>{mvp.name}</strong>
                    <span>
                      {league
                        ? `${mvpTeam?.name ?? "League winner"} · ${mvpAward?.value ?? ""}`
                        : `${result!.games.filter((g) => g.playerOfGameId === mvp.id).length} player-of-the-game awards`}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <strong>82 games. Zero excuses.</strong>
                  <span>29 opponents · 41 home · 41 away</span>
                </>
              )}
            </div>
          </div>
          {done && archived && (
            <div className="archived-season-note">
              <strong>Archived recap</strong>
              <p>
                These scores and your MVP are preserved from the original
                simulation. Start a new eight-player season to unlock player
                statistics, box scores, and team awards.
              </p>
            </div>
          )}
          {done && result?.modelVersion === 2 && (
            <div className="archived-season-note">
              <strong>Earlier team simulation</strong>
              <p>
                This saved season uses the earlier team simulation. Start a new
                run for league-wide rosters, leaders and awards.
              </p>
            </div>
          )}
          {done && !archived && result?.playerStats && (
            <SeasonStats
              players={result.playerStats}
              awards={league ? [] : result.awards}
            />
          )}
          {done && league && <LeaguePanel league={league} />}
          {done && !archived && (
            <p className="schedule-hint">
              Select a game score to open the full box score.
            </p>
          )}
          {!archived && (
            <p className="schedule-hint">
              Rating edge compares your team’s overall rating with the
              opponent’s. It is not a win probability; possessions decide the
              result.
            </p>
          )}
          <div className="schedule-wrap">
            <table className="schedule-table">
              <caption className="sr-only">
                82-game season schedule and results
              </caption>
              <thead>
                <tr>
                  <th scope="col">GAME</th>
                  <th scope="col">OPPONENT</th>
                  <th scope="col">{archived ? "WIN ODDS" : "RATING EDGE"}</th>
                  <th scope="col">{result ? "RESULT" : "VENUE"}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((match, index) => {
                  const team = leagueTeams.find(
                    (team) => team.id === match.opponentId,
                  );
                  const opponent = team
                    ? {
                        id: team.id,
                        name: team.name,
                        offense: team.ratings.offense,
                        defense: team.ratings.defense,
                        style: TACTIC_LABELS[team.tactic],
                      }
                    : OPPONENTS[match.opponentId - 1];
                  const game = showing[index];
                  return (
                    <tr
                      key={index}
                      data-testid={game ? "game-result" : undefined}
                      className={
                        game ? (game.won ? "game-win" : "game-loss") : ""
                      }
                    >
                      <td className="game-number">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      <td>
                        <span className="opponent-mark" aria-hidden="true">
                          {opponent.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")}
                        </span>
                        <span className="opponent-name">
                          {opponent.name}
                          <small>
                            {match.home ? "HOME" : "AWAY"} · {opponent.style}
                          </small>
                        </span>
                      </td>
                      <td className="odds">
                        {archived && game
                          ? `${Math.round(game.winProbability * 100)}%`
                          : `${ratings.overall >= (opponent.offense + opponent.defense) / 2 ? "+" : ""}${(ratings.overall - (opponent.offense + opponent.defense) / 2).toFixed(1)}`}
                      </td>
                      <td>
                        {game ? (
                          done &&
                          !archived &&
                          (game.boxScore || game.leagueGameId) ? (
                            <button
                              type="button"
                              className="game-score game-score-button"
                              aria-label={`View box score for game ${index + 1} against ${opponent.name}, ${game.won ? "win" : "loss"} ${game.teamScore} to ${game.opponentScore}`}
                              onClick={() => setSelectedGame(game)}
                            >
                              <b>{game.won ? "W" : "L"}</b> {game.teamScore}–
                              {game.opponentScore}
                              {game.overtime && (
                                <small>
                                  {" "}
                                  {game.overtimePeriods &&
                                  game.overtimePeriods > 1
                                    ? game.overtimePeriods
                                    : ""}
                                  OT
                                </small>
                              )}
                              <span
                                className="box-score-link-icon"
                                aria-hidden="true"
                              >
                                ↗
                              </span>
                            </button>
                          ) : (
                            <span className="game-score">
                              <b>{game.won ? "W" : "L"}</b> {game.teamScore}–
                              {game.opponentScore}
                              {game.overtime && <small> OT</small>}
                            </span>
                          )
                        ) : (
                          <span className="pending-game">
                            {result
                              ? "—"
                              : match.home
                                ? "Home court"
                                : "On the road"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {done && (
        <p className="season-announcement sr-only" role="status">
          Season complete: {result!.wins} wins, {result!.losses} losses. MVP:{" "}
          {mvp?.name}.
        </p>
      )}
      {done && copyMessage && (
        <p role="status" className="copy-message">
          {copyMessage}
        </p>
      )}
      {done && copyFallback && (
        <textarea
          className="recap-text"
          aria-label="Season recap"
          value={recap}
          readOnly
          onFocus={(e) => e.target.select()}
        />
      )}
      {done && selectedLeagueGame && league && (
        <LeagueBoxScore
          game={selectedLeagueGame}
          teams={league.teams}
          onClose={() => setSelectedGame(null)}
        />
      )}
      {done && selectedGame && !league && (
        <BoxScore
          game={selectedGame}
          opponent={OPPONENTS[selectedGame.opponentId - 1]}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </section>
  );
}
