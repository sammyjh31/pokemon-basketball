import { useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { POKEMON_BY_ID } from "../data/pokemon";
import { simulateMatch } from "../game/match";
import type {
  LeagueBox,
  LeagueGameSummary,
  LeagueTeam,
  PlayType,
} from "../game/types";

const sumFields = [
  "minutes",
  "points",
  "offensiveRebounds",
  "defensiveRebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "fgm",
  "fga",
  "threePM",
  "threePA",
  "ftm",
  "fta",
  "fouls",
  "plusMinus",
  "rimFgm",
  "rimFga",
  "midFgm",
  "midFga",
] as const;
type Totals = Pick<LeagueBox, (typeof sumFields)[number]>;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
const stats = (p: Totals, team = false) => [
  p.minutes,
  p.points,
  p.offensiveRebounds + p.defensiveRebounds,
  p.assists,
  p.steals,
  p.blocks,
  p.turnovers,
  p.fouls,
  team ? "—" : signed(p.plusMinus),
  `${p.fgm}–${p.fga}`,
  `${p.threePM}–${p.threePA}`,
  `${p.ftm}–${p.fta}`,
  `${p.rimFgm}–${p.rimFga}`,
  `${p.midFgm}–${p.midFga}`,
];
const playNames: Record<PlayType, string> = {
  transition: "Transition",
  pickRoll: "Pick & roll",
  isolation: "Isolation",
  post: "Post-up",
  spotUp: "Spot-up",
};
function TeamBox({
  team,
  players,
}: {
  team: LeagueTeam;
  players: LeagueBox[];
}) {
  const totals = Object.fromEntries(
    sumFields.map((key) => [
      key,
      players.reduce((total, p) => total + p[key], 0),
    ]),
  ) as Totals;
  return (
    <section className="league-box-team">
      <h3>{team.name}</h3>
      <div
        className="results-table-wrap box-score-table-wrap"
        role="region"
        tabIndex={0}
        aria-label={`Scrollable ${team.name} box score`}
      >
        <table className="results-table league-box-table">
          <caption className="sr-only">{team.name} player box score</caption>
          <thead>
            <tr>
              {[
                "PLAYER",
                "MIN",
                "PTS",
                "REB",
                "AST",
                "STL",
                "BLK",
                "TOV",
                "PF",
                "+/−",
                "FGM–A",
                "3PM–A",
                "FTM–A",
                "RIM M–A",
                "MID M–A",
              ].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.playerId}>
                <th scope="row">
                  <span className="box-player-name">
                    {POKEMON_BY_ID.get(p.pokemonId)?.name ?? `#${p.pokemonId}`}
                    <small>
                      {p.slot} · {p.started ? "STARTER" : "RESERVE"}
                      {p.fouls >= 6 ? " · 6+ FOULS" : ""}
                    </small>
                  </span>
                </th>
                {stats(p).map((value, i) => (
                  <td key={i}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Team totals</th>
              {stats(totals, true).map((value, i) => (
                <td key={i}>{value}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
export function LeagueBoxScore({
  game,
  teams,
  onClose,
}: {
  game: LeagueGameSummary;
  teams: LeagueTeam[];
  onClose: () => void;
}) {
  const home = teams.find((team) => team.id === game.homeTeamId)!;
  const away = teams.find((team) => team.id === game.awayTeamId)!;
  const match = useMemo(
    () => simulateMatch(home, away, game.seed),
    [home, away, game.seed],
  );
  const dialog = useRef<HTMLDivElement>(null),
    titleId = useId(),
    descriptionId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const star = [...match.homeBox, ...match.awayBox].find(
    (p) => p.playerId === match.playerOfGameId,
  );
  return createPortal(
    <div
      className="dialog-overlay box-score-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="box-score-dialog league-box-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={dialog}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "Tab") {
            const focusable = dialog.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [tabindex="0"]',
            );
            if (!focusable?.length) return;
            const first = focusable[0],
              last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="box-score-heading">
          <div>
            <span className="eyebrow">
              FINAL · ROUND {game.round + 1}
              {match.overtimePeriods > 0
                ? ` · ${match.overtimePeriods > 1 ? match.overtimePeriods : ""}OT`
                : ""}
            </span>
            <h2 id={titleId}>
              {away.name} at {home.name}
            </h2>
          </div>
          <button
            type="button"
            className="box-score-close"
            aria-label="Close box score"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="box-score-matchup">
          <div>
            <span>{away.name} · AWAY</span>
            <strong
              className={
                match.awayScore > match.homeScore ? "winning-score" : ""
              }
            >
              {match.awayScore}
            </strong>
          </div>
          <span className="box-score-versus">FINAL</span>
          <div>
            <span>{home.name} · HOME</span>
            <strong
              className={
                match.homeScore > match.awayScore ? "winning-score" : ""
              }
            >
              {match.homeScore}
            </strong>
          </div>
        </div>
        <p id={descriptionId} className="box-score-summary">
          {48 + 5 * match.overtimePeriods} minutes · {match.possessions}{" "}
          possessions · {match.leadChanges} lead changes.
          {star &&
            ` Player of the game: ${POKEMON_BY_ID.get(star.pokemonId)?.name ?? `#${star.pokemonId}`} (${star.teamId === home.id ? home.name : away.name}).`}
        </p>
        <div
          className="results-table-wrap league-period-wrap"
          role="region"
          tabIndex={0}
          aria-label="Scrollable period scores"
        >
          <table className="results-table">
            <caption className="sr-only">Period scores</caption>
            <thead>
              <tr>
                <th scope="col">TEAM</th>
                {match.periods.map((_, index) => (
                  <th key={index} scope="col">
                    {index < 4 ? `Q${index + 1}` : `OT${index - 3}`}
                  </th>
                ))}
                <th scope="col">FINAL</th>
              </tr>
            </thead>
            <tbody>
              {[
                { team: away, side: "away" as const, score: match.awayScore },
                { team: home, side: "home" as const, score: match.homeScore },
              ].map(({ team, side, score }) => (
                <tr key={team.id}>
                  <th scope="row">{team.name}</th>
                  {match.periods.map((period, i) => (
                    <td key={i}>{period[side]}</td>
                  ))}
                  <td>{score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TeamBox team={away} players={match.awayBox} />
        <TeamBox team={home} players={match.homeBox} />
        <div
          className="results-table-wrap league-plays-wrap"
          role="region"
          tabIndex={0}
          aria-label="Scrollable play types"
        >
          <table className="results-table">
            <caption className="sr-only">Play types and largest leads</caption>
            <thead>
              <tr>
                <th scope="col">PLAY TYPE</th>
                <th scope="col">{away.name}</th>
                <th scope="col">{home.name}</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(playNames) as PlayType[]).map((play) => (
                <tr key={play}>
                  <th scope="row">{playNames[play]}</th>
                  <td>{match.plays[play].away}</td>
                  <td>{match.plays[play].home}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">Largest lead</th>
                <td>{match.largestLead.away}</td>
                <td>{match.largestLead.home}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="box-score-note">
          Shooting columns show makes–attempts. RIM and MID cover two-point
          zones; 3PM–A covers the arc. PF: personal fouls. +/−: team point
          differential while on court. Play types count actions, including
          second chances and foul continuations. A depleted roster may retain a
          player with six fouls to keep five on court.
        </p>
      </div>
    </div>,
    document.body,
  );
}
