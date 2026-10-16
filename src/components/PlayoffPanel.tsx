import { useEffect, useId, useMemo, useRef, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { createPlayoffs, PLAYOFF_ROUND_LABELS } from "../game/playoffs";
import type {
  PlayoffMode,
  Playoffs,
  PlayoffSeries,
} from "../game/playoffTypes";
import type { LeagueGameSummary, LeagueResult } from "../game/types";
import { LeagueBoxScore } from "./LeagueBoxScore";
import { Leaders } from "./LeaguePanel";
import { Portrait } from "./Portrait";
import "../playoffs.css";

const nodeCenter = (round: number, index: number) =>
  (index + 0.5) * 120 * 2 ** round;

export function PlayoffPanel({
  league,
  seasonSeed,
  playoffs,
  onAdvance,
  simulating = false,
  progress,
}: {
  league: LeagueResult;
  seasonSeed: number;
  playoffs?: Playoffs;
  onAdvance: (mode: PlayoffMode) => void;
  simulating?: boolean;
  progress?: { completed: number; total: number };
}) {
  const id = useId();
  const bracket = useMemo(
    () => playoffs ?? createPlayoffs(league, seasonSeed),
    [playoffs, league, seasonSeed],
  );
  const [view, setView] = useState<"bracket" | "players">("bracket");
  const [selection, setSelection] = useState<{ id: string } | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!selection) return;
    detailHeading.current?.focus({ preventScroll: true });
    detailHeading.current?.scrollIntoView?.({
      block: "start",
      behavior: "instant",
    });
  }, [selection]);
  const [selectedGame, setSelectedGame] = useState<{
    game: LeagueGameSummary;
    context: string;
  } | null>(null);
  const teamName = (teamId: number | null) =>
    league.teams.find((team) => team.id === teamId)?.name ?? "TBD";
  const seed = (teamId: number | null) =>
    bracket.seeds.find((entry) => entry.teamId === teamId)?.seed;
  const teamLabel = (teamId: number | null) =>
    teamId === null ? "TBD" : `#${seed(teamId)} ${teamName(teamId)}`;
  const activeRound =
    bracket.series.find((series) => series.winnerId === null)?.round ?? 3;
  const activeSeries = bracket.series.filter(
    (series) => series.round === activeRound && series.winnerId === null,
  );
  const selected =
    bracket.series.find((series) => series.id === selection?.id) ??
    activeSeries.find(
      (series) => series.higherSeedId === 0 || series.lowerSeedId === 0,
    ) ??
    activeSeries[0] ??
    bracket.series.at(-1)!;
  const gamesPlayed = bracket.series.reduce(
    (sum, series) => sum + series.games.length,
    0,
  );
  const userSeed = seed(0);
  const eliminated = bracket.series.find(
    (series) =>
      (series.higherSeedId === 0 || series.lowerSeedId === 0) &&
      series.winnerId !== null &&
      series.winnerId !== 0,
  );
  const userStatus =
    bracket.championId === 0
      ? `Champion · Seed ${userSeed}`
      : !userSeed
        ? "Did not qualify · Top 16 advance"
        : eliminated
          ? `Eliminated · ${PLAYOFF_ROUND_LABELS[eliminated.round]} · Seed ${userSeed}`
          : `Qualified · Seed ${userSeed} · ${PLAYOFF_ROUND_LABELS[activeRound]}`;
  const completed = bracket.championId !== null;
  const mvp =
    completed && bracket.finalsMvp
      ? POKEMON_BY_ID.get(bracket.finalsMvp.pokemonId)
      : undefined;
  const finals = bracket.series.find((series) => series.round === 3);
  const seriesStatus = (series: PlayoffSeries) => {
    if (series.winnerId !== null)
      return `${teamName(series.winnerId)} wins ${Math.max(series.higherSeedWins, series.lowerSeedWins)}–${Math.min(series.higherSeedWins, series.lowerSeedWins)}`;
    if (series.higherSeedId === null || series.lowerSeedId === null)
      return "Awaiting previous round";
    if (!series.games.length) return "Best of 7 · First to 4";
    if (series.higherSeedWins === series.lowerSeedWins)
      return `Series tied ${series.higherSeedWins}–${series.lowerSeedWins}`;
    return `${teamName(series.higherSeedWins > series.lowerSeedWins ? series.higherSeedId : series.lowerSeedId)} leads ${Math.max(series.higherSeedWins, series.lowerSeedWins)}–${Math.min(series.higherSeedWins, series.lowerSeedWins)}`;
  };

  return (
    <section className="playoff-panel" aria-labelledby={`${id}-title`}>
      <div className="results-section-heading playoff-heading">
        <div>
          <span className="eyebrow">THE ROAD TO A CHAMPIONSHIP</span>
          <h3 id={`${id}-title`}>Playoffs</h3>
          <p>16 teams. Four rounds. Every series best of seven.</p>
        </div>
        <span
          className={`playoff-user-status${bracket.championId === 0 ? " is-champion" : ""}`}
          aria-label="Your playoff status"
        >
          {userStatus}
        </span>
      </div>
      <p className="stat-legend">
        Top 16 by regular-season wins, then point differential, then team ID.
        Fixed bracket; no reseeding. Higher seed hosts games 1, 2, 5 and 7.
      </p>
      {completed && (
        <div className="playoff-honors">
          <article className="playoff-champion" aria-label="Playoff champion">
            <span className="eyebrow">PLAYOFF CHAMPION</span>
            <h4>{teamName(bracket.championId)}</h4>
            <p>
              Seed {seed(bracket.championId)} · Wins the Finals{" "}
              {finals
                ? `${Math.max(finals.higherSeedWins, finals.lowerSeedWins)}–${Math.min(finals.higherSeedWins, finals.lowerSeedWins)}`
                : ""}
            </p>
          </article>
          {bracket.finalsMvp && (
            <article className="playoff-mvp" aria-label="Finals MVP">
              {mvp && <Portrait mon={mvp} />}
              <div>
                <span className="eyebrow">Finals MVP</span>
                <h4>{mvp?.name ?? `#${bracket.finalsMvp.pokemonId}`}</h4>
                <p>{teamName(bracket.finalsMvp.teamId)}</p>
                <strong>{bracket.finalsMvp.value}</strong>
                <small>Finals games only</small>
              </div>
            </article>
          )}
        </div>
      )}
      <div className="playoff-advance">
        <div className="playoff-round-status" role="status">
          <strong>
            {completed
              ? "Championship decided"
              : PLAYOFF_ROUND_LABELS[activeRound]}
          </strong>
          <span>
            {gamesPlayed} playoff games played
            {!completed ? ` · ${activeSeries.length} series in progress` : ""}
          </span>
        </div>
        <div
          className="playoff-actions"
          role="group"
          aria-label="Advance playoffs"
        >
          <button
            type="button"
            className="button primary"
            disabled={simulating || completed}
            onClick={() => onAdvance("game")}
          >
            Play next slate
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={simulating || completed}
            onClick={() => onAdvance("round")}
          >
            Finish round
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={simulating || completed}
            onClick={() => onAdvance("all")}
          >
            Finish playoffs
          </button>
        </div>
      </div>
      {!completed && (
        <p className="stat-legend">
          Next slate plays one game in each unfinished series of the current
          round. You can follow every round even after your team is eliminated.
        </p>
      )}
      {simulating && (
        <div className="league-simulation-progress" role="status">
          <span>
            Playing the postseason… {progress?.completed ?? 0} games completed ·
            up to {progress?.total ?? 105} this action
          </span>
          <progress
            aria-label="Playoff simulation progress"
            value={progress?.completed ?? 0}
            max={progress?.total ?? 105}
          />
        </div>
      )}
      <div
        className="league-navigation playoff-navigation"
        role="group"
        aria-label="Playoff views"
      >
        <button
          type="button"
          aria-pressed={view === "bracket"}
          aria-controls={`${id}-content`}
          onClick={() => setView("bracket")}
        >
          Bracket &amp; games
        </button>
        <button
          type="button"
          aria-pressed={view === "players"}
          aria-controls={`${id}-content`}
          onClick={() => setView("players")}
        >
          Playoff player stats
        </button>
      </div>
      <div id={`${id}-content`} className="league-view">
        {view === "bracket" ? (
          <>
            <p className="playoff-scroll-hint" id={`${id}-scroll`}>
              Select any series for its games. Scroll sideways to follow the
              bracket <span aria-hidden="true">→</span>
            </p>
            <div
              className="playoff-bracket-scroll"
              role="region"
              aria-label="Scrollable playoff bracket"
              aria-describedby={`${id}-scroll`}
              tabIndex={0}
            >
              <div className="playoff-bracket">
                <svg
                  className="playoff-connections"
                  width="1060"
                  height="960"
                  aria-hidden="true"
                >
                  {[0, 1, 2].flatMap((round) =>
                    Array.from({ length: 8 / 2 ** round }, (_, index) => (
                      <path
                        key={`${round}-${index}`}
                        d={`M ${round * 276 + 232} ${nodeCenter(round, index)} H ${round * 276 + 254} V ${nodeCenter(round + 1, Math.floor(index / 2))} H ${(round + 1) * 276}`}
                      />
                    )),
                  )}
                </svg>
                {PLAYOFF_ROUND_LABELS.map((roundLabel, round) => (
                  <section
                    className="playoff-round"
                    aria-label={roundLabel}
                    key={roundLabel}
                  >
                    <h4>{roundLabel}</h4>
                    <div className="playoff-round-games">
                      {bracket.series
                        .filter((series) => series.round === round)
                        .map((series) => (
                          <button
                            type="button"
                            className={`playoff-series-node${series.winnerId !== null ? " is-decided" : ""}`}
                            id={`${id}-node-${series.id}`}
                            key={series.id}
                            style={{
                              top: nodeCenter(round, series.index) - 54,
                            }}
                            aria-label={`View ${roundLabel} series ${series.index + 1}: ${teamLabel(series.higherSeedId)} versus ${teamLabel(series.lowerSeedId)}`}
                            aria-pressed={selected.id === series.id}
                            aria-controls={`${id}-series`}
                            onClick={() => setSelection({ id: series.id })}
                          >
                            <span className="playoff-series-label">
                              Series {series.index + 1}
                              {series.winnerId !== null ? " · Final" : ""}
                            </span>
                            {[series.higherSeedId, series.lowerSeedId].map(
                              (teamId, index) => (
                                <span
                                  key={index}
                                  className={`playoff-team${series.winnerId !== null && teamId === series.winnerId ? " is-winner" : ""}${teamId === 0 ? " is-user" : ""}`}
                                >
                                  <span className="playoff-seed">
                                    {seed(teamId) ?? "—"}
                                  </span>
                                  <span>{teamName(teamId)}</span>
                                  <b>
                                    {teamId === null
                                      ? "—"
                                      : index === 0
                                        ? series.higherSeedWins
                                        : series.lowerSeedWins}
                                  </b>
                                </span>
                              ),
                            )}
                            <span className="playoff-series-footer">
                              {series.higherSeedId === null ||
                              series.lowerSeedId === null
                                ? `Winners of ${PLAYOFF_ROUND_LABELS[round - 1]} ${series.index * 2 + 1} & ${series.index * 2 + 2}`
                                : series.winnerId !== null
                                  ? "View series results"
                                  : `Game ${series.games.length + 1} next`}
                            </span>
                          </button>
                        ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
            <section
              className="playoff-series-detail"
              id={`${id}-series`}
              aria-label="Selected playoff series"
            >
              <div className="results-section-heading">
                <div>
                  <span className="eyebrow">
                    {PLAYOFF_ROUND_LABELS[selected.round]} · SERIES{" "}
                    {selected.index + 1}
                  </span>
                  <h4 ref={detailHeading} tabIndex={-1}>
                    {teamLabel(selected.higherSeedId)} vs.{" "}
                    {teamLabel(selected.lowerSeedId)}
                  </h4>
                  <p>{seriesStatus(selected)}</p>
                </div>
                <button
                  type="button"
                  className="button secondary playoff-back"
                  onClick={() => {
                    const node = document.getElementById(
                      `${id}-node-${selected.id}`,
                    );
                    node?.focus({ preventScroll: true });
                    node?.scrollIntoView?.({
                      block: "center",
                      inline: "nearest",
                      behavior: "instant",
                    });
                  }}
                >
                  Back to bracket
                </button>
              </div>
              {selected.higherSeedId !== null && (
                <p className="stat-legend">
                  Home court: {teamName(selected.higherSeedId)} · Games 1, 2, 5
                  &amp; 7
                </p>
              )}
              {selected.games.length ? (
                <div className="playoff-game-list">
                  {selected.games.map((game, index) => (
                    <button
                      type="button"
                      className="playoff-game"
                      key={game.id}
                      aria-label={`View playoff box score: ${PLAYOFF_ROUND_LABELS[selected.round]} · Game ${index + 1}, ${teamName(game.awayTeamId)} ${game.awayScore} at ${teamName(game.homeTeamId)} ${game.homeScore}`}
                      onClick={() =>
                        setSelectedGame({
                          game,
                          context: `${PLAYOFF_ROUND_LABELS[selected.round]} · Game ${index + 1}`,
                        })
                      }
                    >
                      <span className="playoff-game-number">
                        Game {index + 1}
                        <small>
                          FINAL
                          {game.overtimePeriods
                            ? ` · ${game.overtimePeriods > 1 ? game.overtimePeriods : ""}OT`
                            : ""}
                        </small>
                      </span>
                      <span className="playoff-game-teams">
                        <span>
                          {teamName(game.awayTeamId)} <small>AWAY</small>{" "}
                          <b>{game.awayScore}</b>
                        </span>
                        <span>
                          {teamName(game.homeTeamId)} <small>HOME</small>{" "}
                          <b>{game.homeScore}</b>
                        </span>
                      </span>
                      <span className="playoff-box-link">
                        Box score <span aria-hidden="true">↗</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="league-empty">
                  {selected.higherSeedId === null ||
                  selected.lowerSeedId === null
                    ? "This matchup will be set when the previous round finishes."
                    : "No games played in this series yet. Play the next slate to tip off."}
                </p>
              )}
            </section>
          </>
        ) : (
          <>
            {!gamesPlayed && (
              <p className="playoff-stats-note">
                No playoff games played yet. All 128 qualified players start
                fresh here.
              </p>
            )}
            <Leaders
              postseason
              league={{
                teams: league.teams.filter((team) =>
                  bracket.seeds.some((entry) => entry.teamId === team.id),
                ),
                players: bracket.players,
              }}
            />
          </>
        )}
      </div>
      {selectedGame && (
        <LeagueBoxScore
          game={selectedGame.game}
          teams={league.teams}
          contextLabel={selectedGame.context}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </section>
  );
}
