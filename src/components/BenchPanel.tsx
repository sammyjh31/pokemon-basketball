import { coachRotationMinutes } from "../game/coachPolicy";
import type { PlayerDevelopment } from "../game/developmentTypes";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  attributes,
  bestPosition,
  positionRating,
  rotationMinutes,
} from "../game/ratings";
import {
  BENCH_SLOTS,
  DEFENSE_SCHEMES,
  DEFENSE_LABELS,
  type DefenseScheme,
  SLOT_NAMES,
  TACTICS,
  TACTIC_LABELS,
  type RosterSlot,
  type Run,
  type TeamRatings,
  type Tactic,
  type RotationStyle,
} from "../game/types";
import { Portrait } from "./Portrait";
const tacticNotes: Record<Tactic, string> = {
  balanced: "A mix of rim pressure and perimeter shots.",
  pace: "More possessions. Speed and stamina become especially valuable.",
  perimeter: "More threes. Surround your creators with shooters.",
  interior:
    "Attack the paint. Strength, finishing and passing drive the offense.",
  defense: "Slow the pace and lean on stops, rebounding and rim protection.",
};
export function BenchPanel({
  run,
  development,
  ratings,
  pending,
  swap,
  onSlot,
  onAutoFill,
  onTactic,
  onRotation,
  onDefense,
}: {
  run: Run;
  development?: PlayerDevelopment;
  ratings: TeamRatings;
  pending: number | null;
  swap: RosterSlot | null;
  onSlot: (slot: RosterSlot) => void;
  onAutoFill: () => void;
  onTactic: (tactic: Tactic) => void;
  onRotation: (rotation: RotationStyle) => void;
  onDefense: (defense: DefenseScheme) => void;
}) {
  const minutes =
      run.coach && ratings.complete
        ? coachRotationMinutes({
            ...run,
            id: 0,
            name: "Kanto Basketball Club",
            defense: run.defense ?? "man",
            ratings,
            development,
          })
        : rotationMinutes(
            run.roster,
            run.rotation,
            development,
            run.rotationPlan,
          ),
    locked = !!run.result || (run.seasonProgress?.completedRounds ?? 0) > 0;
  return (
    <section className="bench-panel" aria-label="Bench and coaching">
      <div className="bench-heading">
        <div>
          <span className="eyebrow">THE SECOND UNIT</span>
          <h2>
            Three more difference-makers{" "}
            <span>{BENCH_SLOTS.filter((s) => run.roster[s]).length}/3</span>
          </h2>
        </div>
        {run.mode === "free" && !run.leagueTeams && !locked && (
          <button
            className="text-button"
            onClick={onAutoFill}
            disabled={BENCH_SLOTS.every((s) => run.roster[s])}
          >
            Auto-fill bench
          </button>
        )}
      </div>
      <div className="bench-grid">
        {BENCH_SLOTS.map((slot) => {
          const mon = POKEMON_BY_ID.get(run.roster[slot] ?? -1);
          return (
            <button
              key={slot}
              className={`bench-slot ${swap === slot ? "swapping" : ""} ${pending && (!mon || run.mode === "free") ? "available" : ""}`}
              aria-label={`${slot} slot: ${mon?.name ?? "Empty"}`}
              aria-pressed={swap === slot}
              disabled={locked || (!!pending && run.mode === "spin" && !!mon)}
              onClick={() => onSlot(slot)}
            >
              <span className="eyebrow">{SLOT_NAMES[slot]}</span>
              <div className="bench-portrait">
                {mon ? (
                  <Portrait mon={mon} />
                ) : (
                  <span aria-hidden="true">+</span>
                )}
              </div>
              <strong>{mon?.name ?? "Empty slot"}</strong>
              <small>
                {mon
                  ? `${bestPosition(mon, development?.[mon.id])} · ${Math.round(positionRating(mon, bestPosition(mon, development?.[mon.id]), development?.[mon.id]))} FIT`
                  : "Pick any position"}
              </small>
              <span className="bench-minutes">
                {mon
                  ? `${minutes[slot]} MIN · ${Math.round(attributes(mon, development?.[mon.id]).stamina)} STA`
                  : "Ready to contribute"}
              </span>
            </button>
          );
        })}
      </div>
      {!run.coach && (
        <div className="coaching-controls">
          <label>
            Offensive identity
            <select
              aria-label="Coaching style"
              value={run.tactic}
              disabled={locked}
              onChange={(e) => onTactic(e.target.value as Tactic)}
            >
              {TACTICS.map((t) => (
                <option key={t} value={t}>
                  {TACTIC_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Defensive scheme
            <select
              aria-label="Defensive scheme"
              value={run.defense ?? "man"}
              disabled={locked}
              onChange={(e) => onDefense(e.target.value as DefenseScheme)}
            >
              {DEFENSE_SCHEMES.map((d) => (
                <option key={d} value={d}>
                  {DEFENSE_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rotation emphasis
            <select
              aria-label="Rotation emphasis"
              value={run.rotation}
              disabled={locked}
              onChange={(e) => onRotation(e.target.value as RotationStyle)}
            >
              <option value="balanced">Balanced minutes</option>
              <option value="starters">Lean on starters</option>
              <option value="bench">Trust the bench</option>
            </select>
          </label>
        </div>
      )}
      <p className="coaching-note">
        {run.coach
          ? "Your trainer automatically manages tactics and rotation."
          : tacticNotes[run.tactic]}{" "}
        {ratings.complete
          ? "Projected minutes guide substitutions; fatigue, matchups and foul trouble change the rotation."
          : "Fill all eight slots to complete your rotation."}
      </p>
      <div className="rotation-strip" aria-label="Projected minutes">
        {Object.entries(minutes).map(([slot, min]) => (
          <span key={slot}>
            <b>{slot}</b>
            {min}
            <small>MIN</small>
          </span>
        ))}
      </div>
      <div className="team-profile">
        {(
          [
            ["Spacing", ratings.spacing],
            ["Creation", ratings.creation],
            ["Rim protection", ratings.rimProtection],
            ["Bench", ratings.bench],
          ] as const
        ).map(([label, val]) => (
          <span key={label}>
            {label}
            <b>{Math.round(val ?? 0)}</b>
          </span>
        ))}
      </div>
    </section>
  );
}
