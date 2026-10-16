import { useId, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  TRAINING_FOCUSES,
  TRAINING_INTENSITIES,
  type PlayerTrainingPlan,
  type TrainingPlans,
} from "../game/franchiseFeatures";
import { bestPosition } from "../game/ratings";
import {
  TRAINING_FOCUS_LABELS,
  TRAINING_INTENSITY_LABELS,
  validateTrainingPlans,
} from "../game/training";
import {
  POSITIONS,
  POSITION_NAMES,
  ROSTER_SLOTS,
  type Position,
  type Roster,
} from "../game/types";
import { Portrait } from "./Portrait";
import "../coaching.css";

interface TrainingPanelProps {
  roster: Roster;
  plans?: TrainingPlans;
  disabled?: boolean;
  onChange: (plans: TrainingPlans) => void;
}
export function TrainingPanel(props: TrainingPanelProps) {
  return (
    <TrainingDraft
      key={`${JSON.stringify(props.roster)}:${JSON.stringify(props.plans)}`}
      {...props}
    />
  );
}

function TrainingDraft({
  roster,
  plans,
  disabled,
  onChange,
}: TrainingPanelProps) {
  const players = ROSTER_SLOTS.flatMap((slot) => {
    const mon = POKEMON_BY_ID.get(roster[slot] ?? -1);
    return mon ? [{ mon, slot }] : [];
  });
  const [draft, setDraft] = useState<TrainingPlans>(() =>
    Object.fromEntries(
      players.map(({ mon }) => [
        mon.id,
        {
          ...(plans?.[mon.id] ?? { focus: "balanced", intensity: "standard" }),
        },
      ]),
    ),
  );
  const [saved, setSaved] = useState(false);
  const descriptionId = useId();
  function update(id: number, plan: PlayerTrainingPlan) {
    setDraft({ ...draft, [id]: plan });
    setSaved(false);
  }
  return (
    <section
      className="coaching-editor training-panel"
      aria-label="Individual training"
    >
      <div className="coaching-heading">
        <div>
          <span className="eyebrow">BETWEEN SEASONS</span>
          <h3>Individual training</h3>
        </div>
      </div>
      <p id={descriptionId}>
        These plans apply at the next unprocessed offseason. Focused practice
        trades general development for selected skills. Aggressive work raises
        the chance of larger gains and declines. Saved reports never change.
      </p>
      <fieldset disabled={disabled} aria-describedby={descriptionId}>
        <legend className="sr-only">Player training plans</legend>
        <div className="training-grid">
          {players.map(({ mon, slot }) => {
            const plan = draft[mon.id]!;
            return (
              <div className="training-player" key={mon.id}>
                <div className="coaching-player">
                  <Portrait mon={mon} />
                  <span>
                    <strong>{mon.name}</strong>
                    <small>{slot}</small>
                  </span>
                </div>
                <label>
                  Focus
                  <select
                    aria-label={`${mon.name} training focus`}
                    value={plan.focus}
                    onChange={(event) => {
                      const focus = event.target
                        .value as PlayerTrainingPlan["focus"];
                      update(mon.id, {
                        focus,
                        intensity: plan.intensity,
                        ...(focus === "position"
                          ? { position: plan.position ?? bestPosition(mon) }
                          : {}),
                      });
                    }}
                  >
                    {TRAINING_FOCUSES.map((focus) => (
                      <option key={focus} value={focus}>
                        {TRAINING_FOCUS_LABELS[focus]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Intensity
                  <select
                    aria-label={`${mon.name} training intensity`}
                    value={plan.intensity}
                    onChange={(event) =>
                      update(mon.id, {
                        ...plan,
                        intensity: event.target
                          .value as PlayerTrainingPlan["intensity"],
                      })
                    }
                  >
                    {TRAINING_INTENSITIES.map((intensity) => (
                      <option key={intensity} value={intensity}>
                        {TRAINING_INTENSITY_LABELS[intensity]}
                      </option>
                    ))}
                  </select>
                </label>
                {plan.focus === "position" && (
                  <label className="training-position">
                    Target position
                    <select
                      aria-label={`${mon.name} target position`}
                      value={plan.position}
                      onChange={(event) =>
                        update(mon.id, {
                          ...plan,
                          position: event.target.value as Position,
                        })
                      }
                    >
                      {POSITIONS.map((position) => (
                        <option key={position} value={position}>
                          {position} · {POSITION_NAMES[position]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>
        <div className="coaching-actions">
          <button
            className="button primary"
            disabled={!players.length}
            onClick={() => {
              onChange(validateTrainingPlans(draft, roster));
              setSaved(true);
            }}
          >
            Save training plans
          </button>
        </div>
      </fieldset>
      {saved && (
        <p className="coaching-note" role="status">
          Training plans saved for the next unprocessed offseason.
        </p>
      )}
    </section>
  );
}
