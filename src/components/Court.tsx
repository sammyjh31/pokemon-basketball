import { POKEMON_BY_ID } from "../data/pokemon";
import { positionRating } from "../game/ratings";
import {
  POSITIONS,
  POSITION_NAMES,
  type Position,
  type Run,
  type TeamRatings,
} from "../game/types";
import { Portrait } from "./Portrait";
export function Court({
  run,
  ratings,
  pending,
  swap,
  onSlot,
  onReset,
}: {
  run: Run;
  ratings: TeamRatings;
  pending: number | null;
  swap: Position | null;
  onSlot: (position: Position) => void;
  onReset: () => void;
}) {
  return (
    <section className="lineup-panel" aria-label="Your starting lineup">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">KANTO LEAGUE · ORIGINAL 151</span>
          <h2>
            The starting five
            <span className="count-chip">{ratings.filled} / 5</span>
          </h2>
        </div>
        <button className="text-button" onClick={onReset} aria-label="New run">
          <span aria-hidden="true">↻</span> New run
        </button>
      </div>
      <div className="court">
        <div className="court-grain" />
        <svg
          className="court-lines"
          viewBox="0 0 600 450"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M22 0v424h556V0M215 0v160h170V0M215 160a85 85 0 0 0 170 0M215 160a85 85 0 0 1 170 0" />
          <path d="M54 0v48a246 246 0 0 0 492 0V0M245 424a55 55 0 0 1 110 0" />
          <path d="M270 25h60M300 25v9" className="basket-line" />
          <ellipse cx="300" cy="44" rx="17" ry="9" className="basket-line" />
        </svg>
        <div className="court-label">
          KANTO <span> BASKETBALL CLUB</span>
        </div>
        {POSITIONS.map((position) => {
          const mon = POKEMON_BY_ID.get(run.roster[position] ?? -1),
            selectable = !!pending && (!mon || run.mode === "free");
          return (
            <button
              key={position}
              className={`court-slot slot-${position} ${mon ? "filled" : "empty"} ${selectable ? "available" : ""} ${swap === position ? "swapping" : ""}`}
              aria-label={`${position} slot: ${mon?.name ?? "Empty"}`}
              aria-pressed={swap === position}
              disabled={
                !!run.result || (!!pending && run.mode === "spin" && !!mon)
              }
              onClick={() => onSlot(position)}
            >
              <span className="slot-role">{position}</span>
              <span className="slot-disc">
                {mon ? (
                  <Portrait key={mon.id} mon={mon} />
                ) : (
                  <span className="slot-plus" aria-hidden="true">
                    +
                  </span>
                )}
              </span>
              <span className="slot-name">{mon?.name ?? "Empty"}</span>
              <span className="slot-rating">
                {mon
                  ? `${Math.round(positionRating(mon, position))} POS RATING`
                  : POSITION_NAMES[position]}
              </span>
            </button>
          );
        })}
      </div>
      <div className="court-instruction">
        <span className="info-icon" aria-hidden="true">
          i
        </span>
        {pending
          ? "Choose a highlighted position to place your Pokémon."
          : swap
            ? "Choose another position to swap your players."
            : run.result
              ? "Season complete. Your starting five is in the books."
              : run.mode === "spin"
                ? "Pick a Pokémon, then tap an open position. Placements lock in."
                : "Pick any Pokémon. Tap two occupied positions to swap them."}
      </div>
      <div className="team-ratings">
        {(["offense", "defense", "overall"] as const).map((key) => (
          <div className={key === "overall" ? "overall" : ""} key={key}>
            <span className="eyebrow">
              {key === "overall" ? "TEAM OVR" : key.toUpperCase()}
            </span>
            <strong>
              {ratings.filled ? Math.round(ratings[key]) : "—"}
              <small>/100</small>
            </strong>
            <div className="rating-track">
              <span style={{ width: `${ratings[key]}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="rating-caption">
        {ratings.complete
          ? "Your lineup is set. Let’s see what they’re made of."
          : "Ratings are provisional until all five positions are filled."}
      </div>
    </section>
  );
}
