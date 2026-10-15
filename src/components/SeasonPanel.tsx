import { useEffect, useState } from "react";
import { OPPONENTS, SCHEDULE } from "../data/opponents";
import { POKEMON_BY_ID } from "../data/pokemon";
import { winProbability } from "../game/season";
import type { Run, TeamRatings } from "../game/types";
import { Portrait } from "./Portrait";
export function SeasonPanel({
  run,
  ratings,
  animate,
  onSimulate,
}: {
  run: Run;
  ratings: TeamRatings;
  animate: boolean;
  onSimulate: () => void;
}) {
  const result = run.result;
  const reduced =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const [visible, setVisible] = useState(result && !animate ? 82 : 0);
  const [copyMessage, setCopyMessage] = useState(""),
    [copyFallback, setCopyFallback] = useState(false);
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
  const mvp = result ? POKEMON_BY_ID.get(result.mvpId) : null;
  const recap = result
    ? `82–0 Pokémon Basketball\n${result.wins}–${result.losses} · ${run.mode === "spin" ? "Spin & Pick" : "Free Draft"}\n${Object.entries(
        run.roster,
      )
        .map(([p, id]) => `${p}: ${POKEMON_BY_ID.get(id!)!.name}`)
        .join(" · ")}\nMVP: ${mvp?.name}`
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
  const expected = ratings.complete
    ? SCHEDULE.reduce(
        (sum, g) =>
          sum + winProbability(ratings, OPPONENTS[g.opponentId - 1], g.home),
        0,
      )
    : null;
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
                ? "Every game counts. Here’s how your five stacked up."
                : `Game ${visible} of 82. The story is unfolding…`
              : "Your lineup is the beginning. Eighty-two games tell the story."}
          </p>
        </div>
        {!result ? (
          <button
            className="button primary simulate"
            onClick={onSimulate}
            disabled={!ratings.complete}
            aria-label="Simulate season"
          >
            Simulate season{" "}
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
      {!result && !ratings.complete ? (
        <div className="season-empty">
          <div className="empty-season-icon" aria-hidden="true">
            82
          </div>
          <div>
            <strong>Your season is waiting.</strong>
            <p>Fill all five positions to tip things off.</p>
          </div>
          <div
            className="empty-progress"
            aria-label={`${ratings.filled} of 5 positions filled`}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <span className={i < ratings.filled ? "on" : ""} key={i} />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="season-overview">
            <div className="season-record">
              <span className="eyebrow">
                {result ? "SEASON RECORD" : "PROJECTED WINS"}
              </span>
              <strong data-testid="season-record">
                {result ? `${wins}–${losses}` : expected?.toFixed(1)}
              </strong>
              <span>
                {done
                  ? wins === 82
                    ? "THE PERFECT SEASON."
                    : `${Math.round((wins / 82) * 100)}% win rate · ${run.mode === "spin" ? "Spin & Pick" : "Free Draft"}`
                  : result
                    ? "One game at a time."
                    : "Based on your current lineup"}
              </span>
            </div>
            <div className="season-meta">
              <span className="eyebrow">
                {done ? "SEASON MVP" : "THE CHALLENGE"}
              </span>
              {done && mvp ? (
                <div className="mvp">
                  <Portrait mon={mvp} />
                  <div>
                    <strong>{mvp.name}</strong>
                    <span>
                      {
                        result!.games.filter((g) => g.playerOfGameId === mvp.id)
                          .length
                      }{" "}
                      player-of-the-game awards
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
          <div className="schedule-wrap">
            <table className="schedule-table">
              <caption className="sr-only">
                82-game season schedule and results
              </caption>
              <thead>
                <tr>
                  <th scope="col">GAME</th>
                  <th scope="col">OPPONENT</th>
                  <th scope="col">WIN ODDS</th>
                  <th scope="col">{result ? "RESULT" : "VENUE"}</th>
                </tr>
              </thead>
              <tbody>
                {SCHEDULE.map((match, index) => {
                  const opponent = OPPONENTS[match.opponentId - 1],
                    game = showing[index];
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
                        {(
                          winProbability(ratings, opponent, match.home) * 100
                        ).toFixed(0)}
                        %
                      </td>
                      <td>
                        {game ? (
                          <span className="game-score">
                            <b>{game.won ? "W" : "L"}</b> {game.teamScore}–
                            {game.opponentScore}
                            {game.overtime && <small> OT</small>}
                          </span>
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
      {copyMessage && (
        <p role="status" className="copy-message">
          {copyMessage}
        </p>
      )}
      {copyFallback && (
        <textarea
          className="recap-text"
          aria-label="Season recap"
          value={recap}
          readOnly
          onFocus={(e) => e.target.select()}
        />
      )}
    </section>
  );
}
