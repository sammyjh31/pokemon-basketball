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
}) {
  return (
    <header className="masthead" id="top">
      <GameBrand />
      {franchiseActive ? (
        <p className="mode-lock" id="mode-lock">
          <strong>Franchise in progress.</strong> To switch modes, use “End
          franchise / new draft” below the franchise.
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
      <a className="header-play" href="#arcade">
        PLAY ARCADE <span aria-hidden="true">→</span>
      </a>
    </header>
  );
}
