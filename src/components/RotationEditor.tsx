import { useId, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import type { RotationPlan } from "../game/franchiseFeatures";
import {
  defaultRotationPlan,
  validateRotationPlan,
} from "../game/rotationPlan";
import { ROSTER_SLOTS, SLOT_NAMES, type Run } from "../game/types";
import { Portrait } from "./Portrait";
import "../coaching.css";

interface RotationEditorProps {
  run: Run;
  disabled?: boolean;
  onChange: (plan: RotationPlan | undefined) => void;
}

export function RotationEditor(props: RotationEditorProps) {
  if (
    ROSTER_SLOTS.some(
      (slot) => !POKEMON_BY_ID.has(props.run.roster[slot] ?? -1),
    )
  )
    return (
      <section className="coaching-editor" aria-label="Rotation minutes">
        <h3>Set your rotation</h3>
        <p>
          Fill all eight roster slots to set target minutes and a closing five.
        </p>
      </section>
    );
  // A new season, roster, preset or saved plan starts a fresh local draft.
  return (
    <RotationDraft
      key={`${props.run.id}:${JSON.stringify(props.run.roster)}:${props.run.rotation}:${JSON.stringify(props.run.rotationPlan)}:${JSON.stringify(props.run.leagueTeams?.[0]?.development)}`}
      {...props}
    />
  );
}

function RotationDraft({ run, disabled, onChange }: RotationEditorProps) {
  const automatic = () =>
    defaultRotationPlan(
      run.roster,
      run.rotation,
      run.leagueTeams?.[0]?.development,
    );
  const [draft, setDraft] = useState<RotationPlan>(() =>
    run.rotationPlan ? validateRotationPlan(run.rotationPlan) : automatic(),
  );
  const [message, setMessage] = useState("");
  const descriptionId = useId();
  const total = Object.values(draft.minutes).reduce(
    (sum, value) => sum + value,
    0,
  );
  let error = "";
  try {
    validateRotationPlan(draft);
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <section className="coaching-editor" aria-label="Rotation minutes">
      <div className="coaching-heading">
        <div>
          <span className="eyebrow">COURT TIME</span>
          <h3>Set your rotation</h3>
        </div>
        <span className="coaching-badge">
          {run.rotationPlan ? "Custom targets" : "Automatic rotation"}
        </span>
      </div>
      <p id={descriptionId}>
        Allocate 240 target minutes and choose five closers. Actual minutes can
        vary with fouls, close games and overtime. Roster slots determine
        starters; a zero-minute player sits unless foul-outs require cover.
      </p>
      <fieldset disabled={disabled} aria-describedby={descriptionId}>
        <legend className="sr-only">Player minutes and closing lineup</legend>
        <div className="rotation-labels" aria-hidden="true">
          <span>Player</span>
          <span>Minutes</span>
          <span>Close</span>
        </div>
        {ROSTER_SLOTS.map((slot) => {
          const mon = POKEMON_BY_ID.get(run.roster[slot]!)!;
          return (
            <div className="rotation-player" key={slot}>
              <div className="coaching-player">
                <Portrait mon={mon} />
                <span>
                  <strong>{mon.name}</strong>
                  <small>
                    {slot} · {SLOT_NAMES[slot]}
                  </small>
                </span>
              </div>
              <input
                type="number"
                min={0}
                max={48}
                step={1}
                inputMode="numeric"
                aria-label={`${mon.name} target minutes`}
                value={
                  Number.isNaN(draft.minutes[slot]) ? "" : draft.minutes[slot]
                }
                onChange={(event) => {
                  setDraft({
                    ...draft,
                    minutes: {
                      ...draft.minutes,
                      [slot]: event.target.valueAsNumber,
                    },
                  });
                  setMessage("");
                }}
              />
              <input
                type="checkbox"
                aria-label={`${mon.name} closes games`}
                checked={draft.closing.includes(slot)}
                onChange={(event) => {
                  setDraft({
                    ...draft,
                    closing: event.target.checked
                      ? [...draft.closing, slot]
                      : draft.closing.filter((current) => current !== slot),
                  });
                  setMessage("");
                }}
              />
            </div>
          );
        })}
        <div className="coaching-totals" aria-live="polite">
          <strong>{Number.isFinite(total) ? total : "—"} / 240 minutes</strong>
          <span>{draft.closing.length} / 5 closers</span>
        </div>
        {error && (
          <p className="coaching-error" role="status">
            {error}
          </p>
        )}
        <div className="coaching-actions">
          <button
            className="button primary"
            disabled={!!error}
            onClick={() => {
              onChange(validateRotationPlan(draft));
              setMessage("Custom rotation saved.");
            }}
          >
            Save rotation
          </button>
          <button
            className="button"
            onClick={() => {
              setDraft(automatic());
              onChange(undefined);
              setMessage("Automatic rotation restored.");
            }}
          >
            Use automatic rotation
          </button>
        </div>
      </fieldset>
      {disabled && (
        <p className="coaching-note">
          Rotation is locked once the season begins.
        </p>
      )}
      {message && (
        <p className="coaching-note" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
