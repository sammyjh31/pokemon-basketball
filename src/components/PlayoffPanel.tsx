import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Trophy } from "pixelarticons/react/Trophy.js";
import { publicAsset } from "../assets";
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
import { SeriesMatchup, TeamArtwork } from "./ResultsVisuals";

const nodeCenter = (round: number, index: number) =>
  (index + 0.5) * 120 * 2 ** round;

export function PlayoffPanel({
  league,
  seasonSeed,
  playoffs,
  onAdvance,
  onPlayGame,
  simulating = false,
  progress,
  managers,
}: {
  league: LeagueResult;
  seasonSeed: number;
  playoffs?: Playoffs;
  onAdvance: (mode: PlayoffMode) => void;
  onPlayGame?: () => void;
  simulating?: boolean;
  progress?: { completed: number; total: number };
  managers?: { name: string; teamId: number }[];
}) {
  const id = useId();
  const bracket = useMemo(
    () => playoffs ?? createPlayoffs(league, seasonSeed),
    [playoffs, league, seasonSeed],
  );
  const qualifiers = bracket.format?.playoffTeams ?? 16;
  const bestOf = bracket.format?.bestOf ?? 7;
  const rounds = Math.log2(qualifiers);
  const firstRound = 4 - rounds;
  const bracketWidth = rounds * 276 - 44;
  const bracketHeight = (qualifiers / 2) * 120;
  const homeGames =
    bestOf === 1
      ? "1"
      : bestOf === 3
        ? "1 and 3"
        : bestOf === 5
          ? "1, 2 and 5"
          : "1, 2, 5 and 7";
  const [view, setView] = useState<"bracket" | "players">("bracket");
  const [bracketView, setBracketView] = useState<"tree" | "round">(() =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(max-width: 700px)").matches
      ? "round"
      : "tree",
  );
  const [browseRound, setBrowseRound] = useState<number | null>(null);
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
  const followedTeams = managers ?? [{ name: "You", teamId: 0 }];
  const isFollowed = (teamId: number | null) =>
    followedTeams.some((manager) => manager.teamId === teamId);
  const activeRound =
    bracket.series.find((series) => series.winnerId === null)?.round ?? 3;
  const activeSeries = bracket.series.filter(
    (series) => series.round === activeRound && series.winnerId === null,
  );
  const viewedRound = browseRound ?? activeRound;
  const viewedSeries = bracket.series.filter(
    (series) => series.round === viewedRound,
  );
  const selected =
    bracket.series.find((series) => series.id === selection?.id) ??
    viewedSeries.find(
      (series) =>
        isFollowed(series.higherSeedId) || isFollowed(series.lowerSeedId),
    ) ??
    viewedSeries[0] ??
    bracket.series.at(-1)!;
  const gamesPlayed = bracket.series.reduce(
    (sum, series) => sum + series.games.length,
    0,
  );
  const teamStatus = (teamId: number) => {
    const teamSeed = seed(teamId);
    const eliminated = bracket.series.find(
      (series) =>
        (series.higherSeedId === teamId || series.lowerSeedId === teamId) &&
        series.winnerId !== null &&
        series.winnerId !== teamId,
    );
    return bracket.championId === teamId
      ? `Champion · Seed ${teamSeed}`
      : !teamSeed
        ? `Did not qualify · Top ${qualifiers} advance`
        : eliminated
          ? `Eliminated · ${PLAYOFF_ROUND_LABELS[eliminated.round]} · Seed ${teamSeed}`
          : `Qualified · Seed ${teamSeed} · ${PLAYOFF_ROUND_LABELS[activeRound]}`;
  };
  const championManager = managers?.find(
    (manager) => manager.teamId === bracket.championId,
  );
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
    if (!series.games.length)
      return `Best of ${bestOf} · First to ${Math.ceil(bestOf / 2)}`;
    if (series.higherSeedWins === series.lowerSeedWins)
      return `Series tied ${series.higherSeedWins}–${series.lowerSeedWins}`;
    return `${teamName(series.higherSeedWins > series.lowerSeedWins ? series.higherSeedId : series.lowerSeedId)} leads ${Math.max(series.higherSeedWins, series.lowerSeedWins)}–${Math.min(series.higherSeedWins, series.lowerSeedWins)}`;
  };

  return (
    <section
      id="playoffs"
      className="playoff-panel"
      aria-labelledby={`${id}-title`}
    >
      <div
        className="results-section-heading playoff-heading"
        style={{
          backgroundImage: `linear-gradient(90deg,#172b50f5,#172b50d9),url("${publicAsset("/visual/kanto-arena.png")}")`,
        }}
      >
        <div>
          <span className="eyebrow">THE ROAD TO A CHAMPIONSHIP</span>
          <h3 id={`${id}-title`}>Playoffs</h3>
          <p>
            {qualifiers} teams. {rounds} rounds. Every series best of {bestOf}.
          </p>
        </div>
        <span className="playoff-heading-art" aria-hidden="true">
          <TeamArtwork
            roster={
              league.teams.find((team) => team.id === followedTeams[0]?.teamId)
                ?.roster
            }
          />
        </span>
        {!managers && (
          <span
            className={`playoff-user-status${bracket.championId === 0 ? " is-champion" : ""}`}
            aria-label="Your playoff status"
          >
            {teamStatus(0)}
          </span>
        )}
      </div>
      <ol className="playoff-stage-track" aria-label="Championship rounds">
        {PLAYOFF_ROUND_LABELS.map((label, round) =>
          round < firstRound ? null : (
            <li
              key={label}
              aria-current={
                !completed && round === activeRound ? "step" : undefined
              }
              className={completed || round < activeRound ? "is-complete" : ""}
            >
              <span>
                {completed || round < activeRound
                  ? "✓"
                  : String(round - firstRound + 1).padStart(2, "0")}
              </span>
              <div>
                <strong>{label}</strong>
                <small>
                  {
                    bracket.series.filter(
                      (series) =>
                        series.round === round && series.winnerId !== null,
                    ).length
                  }{" "}
                  /{" "}
                  {
                    bracket.series.filter((series) => series.round === round)
                      .length
                  }{" "}
                  series decided
                </small>
              </div>
            </li>
          ),
        )}
      </ol>
      {managers && (
        <div className="playoff-manager-statuses" aria-live="polite">
          {managers.map((manager) => (
            <div
              key={manager.teamId}
              className={`playoff-user-status${bracket.championId === manager.teamId ? " is-champion" : ""}`}
              aria-label={`${manager.name}'s playoff status`}
            >
              <span className="playoff-manager-art" aria-hidden="true">
                <TeamArtwork
                  compact
                  roster={
                    league.teams.find((team) => team.id === manager.teamId)
                      ?.roster
                  }
                />
              </span>
              <strong>
                {manager.name} · {teamName(manager.teamId)}
              </strong>
              <span>{teamStatus(manager.teamId)}</span>
            </div>
          ))}
        </div>
      )}
      <details className="playoff-format-rules">
        <summary>Seeding &amp; home-court rules</summary>
        <p className="stat-legend">
          Top {qualifiers} by regular-season wins, then point differential, then
          team ID. Fixed bracket; no reseeding. Higher seed hosts games{" "}
          {homeGames}.
        </p>
      </details>
      {completed && (
        <div className="playoff-honors">
          <article className="playoff-champion" aria-label="Playoff champion">
            <span className="champion-cup" aria-hidden="true">
              <Trophy width={52} height={52} />
            </span>
            <TeamArtwork
              roster={
                league.teams.find((team) => team.id === bracket.championId)
                  ?.roster
              }
            />
            <span className="eyebrow">PLAYOFF CHAMPION</span>
            <h4>{teamName(bracket.championId)}</h4>
            {managers && (
              <p className="playoff-champion-owner">
                {championManager
                  ? `${championManager.name} wins the championship!`
                  : "CPU-managed team"}
              </p>
            )}
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
          {onPlayGame && !completed && (
            <button
              type="button"
              className="button primary"
              disabled={simulating}
              onClick={onPlayGame}
            >
              Play next playoff game
            </button>
          )}
          <button
            type="button"
            className="button primary"
            disabled={simulating || completed}
            onClick={() => onAdvance("game")}
          >
            {onPlayGame ? "Simulate next slate" : "Play next slate"}
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
          round. You can follow every round even after{" "}
          {managers ? "your teams are" : "your team is"} eliminated.
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
            <div className="bracket-browser-heading">
              <div>
                <span className="eyebrow">THE CHAMPIONSHIP LADDER</span>
                <h4>Every series. One trophy.</h4>
              </div>
              <div
                className="stat-mode"
                role="group"
                aria-label="Bracket layout"
              >
                <button
                  type="button"
                  aria-pressed={bracketView === "round"}
                  onClick={() => setBracketView("round")}
                >
                  Round matchups
                </button>
                <button
                  type="button"
                  aria-pressed={bracketView === "tree"}
                  onClick={() => setBracketView("tree")}
                >
                  Full bracket
                </button>
              </div>
            </div>
            {bracketView === "round" && (
              <div
                className="playoff-round-picker"
                role="group"
                aria-label="Browse playoff rounds"
              >
                {PLAYOFF_ROUND_LABELS.map((label, round) =>
                  round < firstRound ? null : (
                    <button
                      key={label}
                      type="button"
                      aria-label={`Browse ${label}`}
                      aria-pressed={viewedRound === round}
                      onClick={() => {
                        setBrowseRound(round);
                        setSelection(null);
                      }}
                    >
                      <span>
                        {String(round - firstRound + 1).padStart(2, "0")}
                      </span>
                      {label}
                      <small>
                        {
                          bracket.series.filter(
                            (series) =>
                              series.round === round &&
                              series.winnerId !== null,
                          ).length
                        }
                        /
                        {
                          bracket.series.filter(
                            (series) => series.round === round,
                          ).length
                        }{" "}
                        DECIDED
                        {!completed && round === activeRound ? " · LIVE" : ""}
                      </small>
                    </button>
                  ),
                )}
              </div>
            )}
            {bracketView === "round" && viewedRound !== activeRound && (
              <button
                className="button secondary playoff-follow-current"
                type="button"
                onClick={() => {
                  setBrowseRound(null);
                  setSelection(null);
                }}
              >
                Back to {completed ? "Finals" : "current round"}
              </button>
            )}
            <p className="playoff-scroll-hint" id={`${id}-scroll`}>
              {bracketView === "tree"
                ? "Select a series for its games. Scroll across to follow the bracket."
                : "Choose a round, then select a matchup for its games."}
            </p>
            <div
              className={`playoff-bracket-scroll${bracketView === "round" ? " is-round-view" : ""}`}
              role="region"
              aria-label="Scrollable playoff bracket"
              aria-describedby={`${id}-scroll`}
              tabIndex={0}
            >
              <div
                className="playoff-bracket"
                style={{
                  width: bracketView === "tree" ? bracketWidth : undefined,
                  gridTemplateColumns:
                    bracketView === "tree"
                      ? `repeat(${rounds}, 232px)`
                      : undefined,
                }}
              >
                {bracketView === "tree" && (
                  <svg
                    className="playoff-connections"
                    width={bracketWidth}
                    height={bracketHeight}
                    aria-hidden="true"
                  >
                    {Array.from(
                      { length: rounds - 1 },
                      (_, round) => round,
                    ).flatMap((round) =>
                      Array.from(
                        { length: qualifiers / 2 / 2 ** round },
                        (_, index) => (
                          <path
                            key={`${round}-${index}`}
                            d={`M ${round * 276 + 232} ${nodeCenter(round, index)} H ${round * 276 + 254} V ${nodeCenter(round + 1, Math.floor(index / 2))} H ${(round + 1) * 276}`}
                          />
                        ),
                      ),
                    )}
                  </svg>
                )}
                {PLAYOFF_ROUND_LABELS.map((roundLabel, round) =>
                  round < firstRound ||
                  (bracketView === "round" && round !== viewedRound) ? null : (
                    <section
                      className="playoff-round"
                      aria-label={roundLabel}
                      key={roundLabel}
                    >
                      <h4>{roundLabel}</h4>
                      <div
                        className="playoff-round-games"
                        style={{
                          height:
                            bracketView === "tree" ? bracketHeight : undefined,
                        }}
                      >
                        {bracket.series
                          .filter((series) => series.round === round)
                          .map((series) => (
                            <button
                              type="button"
                              className={`playoff-series-node${series.winnerId !== null ? " is-decided" : ""}`}
                              id={`${id}-node-${series.id}`}
                              key={series.id}
                              style={{
                                top:
                                  bracketView === "tree"
                                    ? nodeCenter(
                                        round - firstRound,
                                        series.index,
                                      ) - 54
                                    : undefined,
                              }}
                              aria-label={`View ${roundLabel} series ${series.index + 1}: ${teamLabel(series.higherSeedId)} versus ${teamLabel(series.lowerSeedId)}`}
                              aria-pressed={selected.id === series.id}
                              aria-controls={`${id}-series`}
                              onClick={() => {
                                setBrowseRound(series.round);
                                setSelection({ id: series.id });
                              }}
                            >
                              <span className="playoff-series-label">
                                Series {series.index + 1}
                                {series.winnerId !== null ? " · Final" : ""}
                              </span>
                              {[series.higherSeedId, series.lowerSeedId].map(
                                (teamId, index) => (
                                  <span
                                    key={index}
                                    className={`playoff-team${series.winnerId !== null && teamId === series.winnerId ? " is-winner" : ""}${isFollowed(teamId) ? " is-user" : ""}`}
                                  >
                                    <span className="playoff-seed">
                                      {seed(teamId) ?? "—"}
                                    </span>
                                    <span
                                      className="playoff-node-art"
                                      aria-hidden="true"
                                    >
                                      {teamId !== null && (
                                        <TeamArtwork
                                          compact
                                          roster={
                                            league.teams.find(
                                              (team) => team.id === teamId,
                                            )?.roster
                                          }
                                        />
                                      )}
                                    </span>
                                    <span className="playoff-team-name">
                                      {teamName(teamId)}
                                    </span>
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
                  ),
                )}
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
              <SeriesMatchup
                key={selected.id}
                winsNeeded={Math.ceil(bestOf / 2)}
                sides={[
                  {
                    team: league.teams.find(
                      (team) => team.id === selected.higherSeedId,
                    ),
                    seed: seed(selected.higherSeedId),
                    wins: selected.higherSeedWins,
                    winner:
                      selected.higherSeedId !== null &&
                      selected.winnerId === selected.higherSeedId,
                  },
                  {
                    team: league.teams.find(
                      (team) => team.id === selected.lowerSeedId,
                    ),
                    seed: seed(selected.lowerSeedId),
                    wins: selected.lowerSeedWins,
                    winner:
                      selected.lowerSeedId !== null &&
                      selected.winnerId === selected.lowerSeedId,
                  },
                ]}
              />
              {selected.higherSeedId !== null && (
                <p className="stat-legend">
                  Home court: {teamName(selected.higherSeedId)} · Games{" "}
                  {homeGames}
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
                No playoff games played yet. All {qualifiers * 8} qualified
                players start fresh here.
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
          match={bracket.playedGames?.[selectedGame.game.id]?.match}
          teams={league.teams}
          contextLabel={selectedGame.context}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </section>
  );
}
