import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { POKEMON_BY_ID } from "../data/pokemon";
import type { GameResult, Opponent, PlayerBox } from "../game/types";

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
] as const;
type Totals = Pick<PlayerBox, (typeof sumFields)[number]>;
const stats = (player: Totals) => [
  player.minutes,
  player.points,
  player.offensiveRebounds + player.defensiveRebounds,
  player.assists,
  player.steals,
  player.blocks,
  player.turnovers,
  `${player.fgm}–${player.fga}`,
  `${player.threePM}–${player.threePA}`,
  `${player.ftm}–${player.fta}`,
];

export function BoxScore({
  game,
  opponent,
  onClose,
}: {
  game: GameResult;
  opponent: Opponent;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId(),
    descriptionId = useId();
  const players = game.boxScore ?? [];
  const totals = Object.fromEntries(
    sumFields.map((key) => [
      key,
      players.reduce((total, player) => total + player[key], 0),
    ]),
  ) as Totals;
  const overtime = game.overtimePeriods ?? Number(game.overtime);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="dialog-overlay box-score-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="box-score-dialog"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "Tab") {
            const focusable = dialog.current?.querySelectorAll<HTMLElement>(
              'button, [tabindex="0"]',
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
              FINAL · {game.home ? "HOME COURT" : "ON THE ROAD"}
              {overtime > 0 ? ` · ${overtime > 1 ? overtime : ""}OT` : ""}
            </span>
            <h2 id={titleId}>Game {game.index + 1} box score</h2>
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
            <span>Your team</span>
            <strong className={game.won ? "winning-score" : ""}>
              {game.teamScore}
            </strong>
          </div>
          <span className="box-score-versus">FINAL</span>
          <div>
            <span>{opponent.name}</span>
            <strong className={!game.won ? "winning-score" : ""}>
              {game.opponentScore}
            </strong>
          </div>
        </div>
        <p id={descriptionId} className="box-score-summary">
          {game.won ? "A team win." : "A game to learn from."}{" "}
          {48 + overtime * 5} minutes of basketball · {totals.minutes}{" "}
          player-minutes
          {game.possessions !== undefined
            ? ` · ${game.possessions} possessions`
            : ""}
          .
        </p>
        <div
          className="results-table-wrap box-score-table-wrap"
          role="region"
          tabIndex={0}
          aria-label="Scrollable player box score"
        >
          <table className="results-table box-score-table">
            <caption className="sr-only">
              Game {game.index + 1} player box score against {opponent.name}
            </caption>
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
                  "FGM–A",
                  "3PM–A",
                  "FTM–A",
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.pokemonId}>
                  <th scope="row">
                    <span className="box-player-name">
                      {POKEMON_BY_ID.get(player.pokemonId)?.name ??
                        `#${player.pokemonId}`}
                      <small>
                        {player.slot} ·{" "}
                        {player.slot.startsWith("B") ? "RESERVE" : "STARTER"}
                      </small>
                    </span>
                  </th>
                  {stats(player).map((value, index) => (
                    <td key={index}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Team totals</th>
                {stats(totals).map((value, index) => (
                  <td key={index}>{value}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="box-score-note">
          REB combines offensive and defensive rebounds. Shooting columns show
          makes–attempts. Opponent results are simulated at team level.
        </p>
      </div>
    </div>,
    document.body,
  );
}
