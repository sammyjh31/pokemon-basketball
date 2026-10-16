import { useState } from "react";
import type { ArcadeSettings } from "../arcade/settings";
import type { ArcadePlayer, ArcadeState } from "../game/arcade/types";
import { ArcadeDialog } from "./ArcadeDialog";
import { ArcadeControlsGuide, ArcadePortrait } from "./ArcadeSetup";
export function ArcadeSettingsControls({
  settings,
  onChange,
}: {
  settings: ArcadeSettings;
  onChange: (settings: ArcadeSettings) => void;
}) {
  return (
    <div className="arcade-settings">
      <label>
        <input
          type="checkbox"
          checked={settings.audio}
          onChange={(event) =>
            onChange({ ...settings, audio: event.target.checked })
          }
        />
        Court audio
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(event) =>
            onChange({ ...settings, reducedMotion: event.target.checked })
          }
        />
        Reduced effects
      </label>
    </div>
  );
}
function EnergyRow({ player }: { player: ArcadePlayer }) {
  return (
    <li>
      <ArcadePortrait id={player.pokemonId} />
      <div>
        <strong>{player.name}</strong>
        <span>
          {player.slot} · {player.active ? "On court" : "Reserve"}
        </span>
      </div>
      <div className="arcade-energy">
        <meter
          min="0"
          max="100"
          value={player.energy}
          aria-label={`${player.name} energy`}
        />
        <span>{Math.round(player.energy)}%</span>
      </div>
    </li>
  );
}
export function ArcadePause({
  state,
  settings,
  onSettings,
  onQueue,
  onCancel,
  onResume,
  onLeave,
}: {
  state: ArcadeState;
  settings: ArcadeSettings;
  onSettings: (settings: ArcadeSettings) => void;
  onQueue: (outId: number, inId: number) => boolean;
  onCancel: (outId: number) => void;
  onResume: () => void;
  onLeave: () => void;
}) {
  const players = state.players.filter((player) => player.team === 0),
    active = players.filter((player) => player.active),
    bench = players.filter((player) => !player.active);
  const [outId, setOut] = useState(active[0]?.id ?? 0),
    [inId, setIn] = useState(bench[0]?.id ?? 5),
    [error, setError] = useState("");
  const rest = active.some((player) => player.id === outId)
    ? outId
    : active[0]?.id;
  const bring = bench.some((player) => player.id === inId)
    ? inId
    : bench[0]?.id;
  const inBreak = state.phase === "break";
  return (
    <ArcadeDialog
      title={
        inBreak
          ? state.period === 2
            ? "Halftime"
            : state.period >= 4
              ? "Overtime ahead"
              : `Quarter ${state.period} complete`
          : "Time out"
      }
      eyebrow={`${state.names[0]} ${state.score[0]} — ${state.score[1]} ${state.names[1]}`}
      onClose={onResume}
    >
      <div className="arcade-modal-actions">
        <button
          data-gamepad-resume
          className="arcade-button arcade-primary"
          onClick={onResume}
        >
          {inBreak ? "Continue" : "Resume game"}
        </button>
        <button className="arcade-button arcade-quiet" onClick={onLeave}>
          {state.official ? "Leave official game" : "Leave exhibition"}
        </button>
      </div>
      <div className="arcade-section-title">
        <h3>Your rotation</h3>
        <span className="arcade-tag">5 ON COURT / 3 RESERVES</span>
      </div>
      <p className="arcade-muted">
        {inBreak
          ? "Fresh legs for the next period. Swaps take effect before play resumes."
          : "Queue a swap for the next dead ball. Your drafted lineup stays saved."}
      </p>
      <ul className="arcade-energy-roster" aria-label="Your team energy">
        {players.map((player) => (
          <EnergyRow key={player.id} player={player} />
        ))}
      </ul>
      <div className="arcade-sub-form">
        <label>
          Player to rest
          <select
            value={rest}
            onChange={(event) => setOut(Number(event.target.value))}
          >
            {active.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} · {Math.round(player.energy)}%
              </option>
            ))}
          </select>
        </label>
        <span aria-hidden="true">⇄</span>
        <label>
          Reserve to bring in
          <select
            value={bring}
            onChange={(event) => setIn(Number(event.target.value))}
          >
            {bench.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} · {Math.round(player.energy)}%
              </option>
            ))}
          </select>
        </label>
        <button
          className="arcade-button"
          onClick={() => {
            setError(
              onQueue(rest, bring)
                ? ""
                : "That player is already in a queued swap. Cancel it first.",
            );
          }}
        >
          Queue swap
        </button>
      </div>
      {error && (
        <p role="alert" className="arcade-error">
          {error}
        </p>
      )}
      {state.pendingSubs.length > 0 && (
        <ul className="arcade-pending" aria-label="Queued substitutions">
          {state.pendingSubs.map((sub) => (
            <li key={sub.outId}>
              <span>
                <b>
                  {state.players.find((player) => player.id === sub.inId)?.name}
                </b>{" "}
                in for{" "}
                {state.players.find((player) => player.id === sub.outId)?.name}
                <small>Next dead ball</small>
              </span>
              <button
                className="arcade-link"
                onClick={() => {
                  onCancel(sub.outId);
                  setError("");
                }}
                aria-label={`Cancel swap for ${state.players.find((player) => player.id === sub.outId)?.name}`}
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      )}
      <details className="arcade-details">
        <summary>Opponent rotation</summary>
        <ul className="arcade-energy-roster">
          {state.players
            .filter((player) => player.team === 1)
            .map((player) => (
              <EnergyRow key={player.id} player={player} />
            ))}
        </ul>
      </details>
      <details className="arcade-details">
        <summary>Controls & court rules</summary>
        <ArcadeControlsGuide />
        <p className="arcade-muted">
          Three unanswered baskets ignite a 10-second hot streak. Turbo + pass
          can throw a lob to a teammate cutting near the rim. Four one-minute
          quarters; tied games add {state.official ? "25" : "30"}-second
          overtimes. No fouls or free throws.
        </p>
      </details>
      <ArcadeSettingsControls settings={settings} onChange={onSettings} />
      <p className="arcade-session-note">
        {state.official
          ? "Refreshing or leaving before the final buzzer ends this attempt; the fixture stays pending. Match progress is not saved."
          : "Refreshing or leaving ends this exhibition. Match progress is not saved."}
      </p>
    </ArcadeDialog>
  );
}
