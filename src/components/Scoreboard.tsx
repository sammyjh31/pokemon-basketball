import type { Mode, Records, TeamRatings } from "../game/types";
export function Basketball({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 24h42M24 3v42M9 9q30 15 0 30M39 9Q9 24 39 39"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
export function Scoreboard({
  ratings,
  records,
  mode,
}: {
  ratings: TeamRatings;
  records: Records;
  mode: Mode;
}) {
  const record = records[mode];
  return (
    <>
      <header className="masthead">
        <a className="brand" href="#top" aria-label="82–0 Pokémon Basketball">
          <Basketball />
          <span className="brand-number">
            82<span>–</span>0
          </span>
          <span className="brand-name">
            POKÉMON
            <br />
            BASKETBALL
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a className="active" href="#draft">
            Draft room
          </a>
          <a href="#season">Season</a>
          <a href="#rules">
            How to play{" "}
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
          </a>
        </nav>
        <span className="header-tag">
          <span className="status-dot" /> KANTO LEAGUE
        </span>
      </header>
      <section className="intro" id="top">
        <div>
          <div className="eyebrow">
            <span className="orange-line" /> FIVE POKÉMON. ONE PERFECT SEASON.
          </div>
          <h1>
            BUILD YOUR <em>STARTING FIVE.</em>
          </h1>
          <p>A little strategy. A little luck. A whole lot of Pokémon.</p>
        </div>
        <div className="personal-best">
          <span className="eyebrow">
            PERSONAL BEST{" "}
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
          </span>
          <strong>
            {record.runs ? `${record.bestWins}–${82 - record.bestWins}` : "—"}
          </strong>
          <span>
            {record.perfectSeasons} perfect seasons · {record.runs} runs
          </span>
        </div>
      </section>
      <div className="mobile-rating sr-only" aria-live="polite">
        {ratings.filled} of 5 starters drafted
      </div>
    </>
  );
}
