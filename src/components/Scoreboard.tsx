import type { Mode } from "../game/types";
export function Scoreboard({
  mode,
  onMode,
  disabled = false,
}: {
  mode: Mode;
  disabled?: boolean;
  onMode: (mode: Mode) => void;
}) {
  return (
    <header className="masthead" id="top">
      <a className="brand" href="#draft" aria-label="82–0 Pokémon Basketball">
        POKÉMON <span>82–0</span>
        <small>BASKETBALL</small>
      </a>
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
        <a href="#season">SEASON</a>
        <a href="#rules">SCOUTING GUIDE</a>
      </nav>
      <a className="header-play" href="#season">
        PLAY WITH YOUR TEAM <span aria-hidden="true">→</span>
      </a>
    </header>
  );
}
