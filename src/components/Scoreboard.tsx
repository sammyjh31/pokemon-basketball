import { GameBrand } from "./KantoShell";
import type { Mode } from "../game/types";
export function Scoreboard({
  mode,
  onMode,
  disabled = false,
  franchiseActive = false,
  onLocalLeague,
  localLeagueDisabled = false,
  onGuide,
  onHowToPlay,
  onRestart,
}: {
  mode: Mode;
  disabled?: boolean;
  /** Mode tabs are hidden while a franchise runs; switching would replace it. */
  franchiseActive?: boolean;
  onMode: (mode: Mode) => void;
  onLocalLeague?: () => void;
  localLeagueDisabled?: boolean;
  onGuide?: () => void;
  onHowToPlay?: () => void;
  onRestart?: () => void;
}) {
  return (
    <header className="masthead" id="top">
      <GameBrand />
      {franchiseActive ? (
        <p className="mode-lock" id="mode-lock">
          <strong>Franchise in progress.</strong> Use “New game / Restart” to
          end this franchise and start a new draft.
        </p>
      ) : (
        <nav className="mode-tabs" aria-label="Game modes">
          <button
            disabled={disabled}
            aria-label="Lineup builder"
            aria-pressed={mode === "free"}
            onClick={() => onMode("free")}
          >
            LINEUP BUILDER
          </button>
          <button
            disabled={disabled}
            className="challenge-tab"
            aria-label="82–0 Challenge"
            aria-pressed={mode === "spin"}
            onClick={() => onMode("spin")}
          >
            <span>82–0</span> CHALLENGE
          </button>
          {onLocalLeague && (
            <button
              disabled={localLeagueDisabled}
              onClick={onLocalLeague}
              aria-label="Local league"
            >
              LOCAL LEAGUE
            </button>
          )}
        </nav>
      )}
      {franchiseActive && onLocalLeague && (
        <nav className="mode-tabs" aria-label="Game modes">
          <button
            disabled={localLeagueDisabled}
            onClick={onLocalLeague}
            aria-label="Local league"
          >
            LOCAL LEAGUE
          </button>
        </nav>
      )}
      <nav className="page-links" aria-label="On this page">
        <a href="#season">Season</a>
        {onGuide && (
          <button type="button" onClick={onGuide}>
            Scouting guide
          </button>
        )}
        {onHowToPlay && (
          <button type="button" onClick={onHowToPlay}>
            How to play
          </button>
        )}
      </nav>
      <div className="masthead-actions">
        {onRestart && (
          <button
            type="button"
            className="header-restart"
            disabled={disabled}
            onClick={onRestart}
          >
            New game / Restart
          </button>
        )}
        <a className="header-play" href="#arcade">
          PLAY ARCADE <span aria-hidden="true">→</span>
        </a>
      </div>
    </header>
  );
}
