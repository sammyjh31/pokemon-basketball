import { shinyPokemon } from "../game/shiny";
import { projectedCoaches } from "../game/coachOffice";
import { CoachSummary } from "./CoachSummary";
import { useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import type { Franchise } from "../game/franchiseTypes";
import type { OffseasonRosterSettings } from "../game/offseasonRoster";
import { createRun } from "../game/draft";
import {
  ROSTER_SLOTS,
  SLOT_NAMES,
  TACTICS,
  TACTIC_LABELS,
  DEFENSE_SCHEMES,
  DEFENSE_LABELS,
  ROTATIONS,
  type Position,
  type RosterSlot,
} from "../game/types";
import { positionRating, bestPosition } from "../game/ratings";
import { Portrait } from "./Portrait";
import { RotationEditor } from "./RotationEditor";
import "../offseasonRoster.css";
export function OffseasonRoster({
  franchise,
  disabled = false,
  onChange,
}: {
  franchise: Franchise;
  disabled?: boolean;
  onChange: (settings: OffseasonRosterSettings) => void;
}) {
  const team = projectedCoaches(
    franchise.teams,
    franchise.coachOffice,
    franchise.year,
  )[0];
  const automaticCoaching = !!franchise.teams[0].coach;
  const [message, setMessage] = useState("");
  const settings: OffseasonRosterSettings = {
    roster: team.roster,
    tactic: team.tactic,
    defense: team.defense,
    rotation: team.rotation,
    rotationPlan: team.rotationPlan,
  };
  const save = (next: OffseasonRosterSettings) => {
    onChange(next);
    setMessage(
      "Offseason roster saved. These choices carry into your next season.",
    );
  };
  const swap = (slot: RosterSlot, id: number) => {
    const other = ROSTER_SLOTS.find((s) => team.roster[s] === id);
    if (!other || other === slot) return;
    save({
      ...settings,
      roster: { ...team.roster, [slot]: id, [other]: team.roster[slot] },
    });
  };
  const run = {
    ...createRun("free", true, franchise.year),
    ...settings,
    leagueTeams: franchise.teams,
  };
  return (
    <section
      className="offseason-roster-editor"
      aria-label="Offseason roster management"
    >
      <header>
        <span className="eyebrow">BUILD THE NEXT EIGHT</span>
        <h3>Your roster, your roles.</h3>
        <p>
          Promote reserves, move starters and set your coaching now. Selecting a
          player swaps their two roster slots. Changes save immediately; minutes
          belong to the roster slot.
        </p>
      </header>
      <fieldset disabled={disabled} className="offseason-roster-fields">
        <legend className="sr-only">Offseason roster and coaching</legend>
        <div className="offseason-roster-grid">
          {ROSTER_SLOTS.map((slot) => {
            const id = team.roster[slot]!,
              mon = shinyPokemon(POKEMON_BY_ID.get(id)!, team.shinySeed);
            return (
              <label key={slot} className="offseason-roster-card">
                <Portrait mon={mon} />
                <span>{SLOT_NAMES[slot]}</span>
                <select
                  aria-label={`${SLOT_NAMES[slot]} player`}
                  value={id}
                  onChange={(e) => swap(slot, Number(e.target.value))}
                >
                  {ROSTER_SLOTS.map((s) => (
                    <option key={s} value={team.roster[s]!}>
                      {POKEMON_BY_ID.get(team.roster[s]!)!.name} · {s}
                    </option>
                  ))}
                </select>
                <small>
                  {Math.round(
                    positionRating(
                      mon,
                      slot.startsWith("B")
                        ? bestPosition(mon, team.development?.[id])
                        : (slot as Position),
                      team.development?.[id],
                    ),
                  )}{" "}
                  role fit
                </small>
              </label>
            );
          })}
        </div>
        {team.coach ? (
          <CoachSummary team={team} nextSeason />
        ) : automaticCoaching ? (
          <p className="notice">
            Hire a head coach in the Coaches tab before starting next season.
          </p>
        ) : (
          <div className="league-controls">
            <label className="league-field">
              Offseason offense
              <select
                value={team.tactic}
                onChange={(e) =>
                  save({
                    ...settings,
                    tactic: e.target.value as typeof team.tactic,
                  })
                }
              >
                {TACTICS.map((t) => (
                  <option key={t} value={t}>
                    {TACTIC_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="league-field">
              Offseason defense
              <select
                value={team.defense}
                onChange={(e) =>
                  save({
                    ...settings,
                    defense: e.target.value as typeof team.defense,
                  })
                }
              >
                {DEFENSE_SCHEMES.map((d) => (
                  <option key={d} value={d}>
                    {DEFENSE_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="league-field">
              Offseason rotation
              <select
                value={team.rotation}
                onChange={(e) =>
                  save({
                    ...settings,
                    rotation: e.target.value as typeof team.rotation,
                    rotationPlan: undefined,
                  })
                }
              >
                {ROTATIONS.map((r) => (
                  <option key={r} value={r}>
                    {
                      {
                        balanced: "Balanced minutes",
                        starters: "Lean on starters",
                        bench: "Trust the bench",
                      }[r]
                    }
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </fieldset>
      <p role="status">{message}</p>
      {!automaticCoaching && !team.coach && (
        <RotationEditor
          run={run}
          disabled={disabled}
          onChange={(rotationPlan) => save({ ...settings, rotationPlan })}
        />
      )}
    </section>
  );
}
