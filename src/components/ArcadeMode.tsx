import { useEffect, useRef, useState } from "react";
import { ArcadeInputController } from "../arcade/input";
import { useArcadeGamepad } from "../hooks/useArcadeGamepad";
import { ArcadeAudio } from "../arcade/audio";
import { loadArcadeAssets } from "../arcade/renderer";
import {
  readArcadeSettings,
  saveArcadeSettings,
  type ArcadeSettings,
} from "../arcade/settings";
import { attackDirection, playerOfGame } from "../game/arcade/engine";
import { createGame } from "../game/arcade/setup";
import { abilitiesEnabled } from "../game/abilities";
import type { ArcadeState } from "../game/arcade/types";
import type { Run } from "../game/types";
import { useArcade } from "../hooks/useArcade";
import { ArcadeDialog } from "./ArcadeDialog";
import { ArcadePause, ArcadeSettingsControls } from "./ArcadePause";
import { ArcadeResults } from "./ArcadeResults";
import {
  ArcadePortrait,
  ArcadeSetupScreen,
  prepareArcadeTeams,
} from "./ArcadeSetup";
import { ArcadeTouchControls } from "./ArcadeTouchControls";
import {
  OfficialArcadeResults,
  OfficialArcadeSetup,
  type OfficialArcadeProps,
} from "./OfficialArcade";
export type { OfficialArcadeProps } from "./OfficialArcade";
import "../arcade.css";

const clockLabel = (clock: number) =>
  `${Math.floor(Math.ceil(clock) / 60)}:${String(Math.ceil(clock) % 60).padStart(2, "0")}`;
function ArcadeGame({
  state,
  assets,
  settings,
  audio,
  onSettings,
  onRematch,
  onChangeOpponent,
  onExit,
  official,
  input,
}: {
  state: ArcadeState;
  assets: Map<number, HTMLImageElement>;
  settings: ArcadeSettings;
  audio: ArcadeAudio;
  onSettings: (settings: ArcadeSettings) => void;
  onRematch: () => void;
  onChangeOpponent: () => void;
  onExit: () => void;
  official?: OfficialArcadeProps;
  input: ArcadeInputController;
}) {
  const runtime = useArcade(state, assets, settings, audio, input),
    s = runtime.snapshot;
  const [leaving, setLeaving] = useState(false);
  const controlled = s.players.find((player) => player.id === s.controlled)!;
  const direction = attackDirection(s, 0) > 0 ? "→" : "←";
  if (runtime.error)
    return (
      <div className="arcade-card arcade-fatal" role="alert">
        <p className="arcade-eyebrow">COURT UNAVAILABLE</p>
        <h1>Let’s reset the court.</h1>
        <p>{runtime.error}</p>
        <button className="arcade-button arcade-primary" onClick={onExit}>
          Back to roster
        </button>
      </div>
    );
  if (s.phase === "final")
    // The HUD snapshot trims events; official conversion needs the complete final history.
    if (official)
      return (
        <OfficialArcadeResults
          state={state}
          official={official}
          onExit={onExit}
        />
      );
  if (s.phase === "final")
    return (
      <ArcadeResults
        state={s}
        mvp={playerOfGame(s)}
        onRematch={onRematch}
        onChangeOpponent={onChangeOpponent}
        onExit={onExit}
      />
    );
  const isPaused = s.paused || s.phase === "break";
  return (
    <div className="arcade-game">
      <div className="arcade-topline">
        <span className="arcade-wordmark">
          POKÉMON <b>HOOPS</b>
        </span>
        <div className="arcade-live-toolbar">
          <span className="arcade-tag">
            {official ? "OFFICIAL SEASON GAME" : "5v5 EXHIBITION"}
          </span>
          <button
            className="arcade-button arcade-quiet arcade-pause-button"
            aria-label="Pause game"
            data-gamepad-pause
            onClick={runtime.pause}
          >
            Ⅱ <span>Pause</span>
          </button>
        </div>
      </div>
      {official && (
        <p className="arcade-session-note">
          {official.label} · Court score {s.score[0]}–{s.score[1]} · Official
          score {s.score[0] * 12}–{s.score[1] * 12} · You / CPU
        </p>
      )}
      <div
        className="arcade-scoreboard"
        aria-label={`${s.names[0]} ${s.score[0]}, ${s.names[1]} ${s.score[1]}`}
      >
        <div className="arcade-score-team arcade-home">
          <span className="arcade-team-label">
            YOU {s.fire[0] > 0 ? " / ON FIRE" : ""}
          </span>
          <strong>{s.names[0]}</strong>
          <b>{s.score[0]}</b>
        </div>
        <div className="arcade-clock">
          <span>
            {s.period > 4 ? `OT ${s.period - 4}` : `QUARTER ${s.period}`}
          </span>
          <strong>{clockLabel(s.clock)}</strong>
          <small className={s.shotClock <= 4 ? "urgent" : ""}>
            SHOT CLOCK <b>{Math.ceil(s.shotClock)}</b>
          </small>
        </div>
        <div className="arcade-score-team arcade-away">
          <span className="arcade-team-label">
            CPU {s.fire[1] > 0 ? " / ON FIRE" : ""}
          </span>
          <strong>{s.names[1]}</strong>
          <b>{s.score[1]}</b>
        </div>
      </div>
      <div
        data-gamepad-play
        ref={runtime.gameplayRef}
        className="arcade-gameplay"
        inert={isPaused || leaving}
      >
        <div className="arcade-canvas-frame">
          <canvas
            ref={runtime.canvasRef}
            className="arcade-canvas"
            aria-label="Five-on-five basketball court. Move with WASD or arrows. Hold and release J to shoot, K to pass, L to switch, Shift for turbo, Escape to pause. Controller: left stick to move, X to shoot, A to pass, B to switch, RT for turbo, Menu to pause."
            tabIndex={0}
            onPointerDown={() =>
              runtime.canvasRef.current?.focus({ preventScroll: true })
            }
          />
        </div>
        <div className="arcade-player-strip">
          <div className="arcade-controlled">
            <ArcadePortrait id={controlled.pokemonId} />
            <div>
              <span>YOU CONTROL</span>
              <strong>{controlled.name}</strong>
            </div>
            <meter
              min="0"
              max="100"
              value={controlled.energy}
              aria-label="Controlled player turbo energy"
            />
            <b>{Math.round(controlled.energy)}%</b>
          </div>
          <div className="arcade-possession">
            <span>
              {s.phase === "tipoff"
                ? "JUMP BALL"
                : s.phase === "inbound"
                  ? `INBOUND · ${Math.max(0, Math.ceil(5 - s.phaseTime))}s`
                  : s.possession === 0
                    ? "YOUR POSSESSION"
                    : "ON DEFENSE"}
            </span>
            <strong>YOUR BASKET {direction}</strong>
          </div>
        </div>
        <ArcadeTouchControls
          key={isPaused ? "paused" : "playing"}
          input={runtime.input}
          onActivate={() =>
            runtime.canvasRef.current?.focus({ preventScroll: true })
          }
        />
      </div>
      <div className="arcade-game-status" role="status" aria-live="polite">
        {s.messageTime > 0
          ? s.message
          : s.possession === 0
            ? "Move the ball. Find your shot."
            : "Stay in front. Protect the rim."}
      </div>
      {isPaused && !leaving && (
        <ArcadePause
          state={s}
          settings={settings}
          onSettings={onSettings}
          onQueue={runtime.queue}
          onCancel={runtime.cancel}
          onResume={runtime.resume}
          onLeave={() => {
            runtime.pause();
            setLeaving(true);
          }}
        />
      )}
      {leaving && (
        <ArcadeDialog
          title="Leave this game?"
          onClose={() => setLeaving(false)}
        >
          <p>
            {official
              ? "This attempt will end without recording a result. The fixture stays pending, ready to play again or simulate."
              : "This exhibition will end. Your drafted roster and saved season stay as they are."}
          </p>
          <div className="arcade-modal-actions">
            <button
              className="arcade-button arcade-primary"
              onClick={() => setLeaving(false)}
            >
              Keep playing
            </button>
            <button className="arcade-button arcade-quiet" onClick={onExit}>
              Leave game
            </button>
          </div>
        </ArcadeDialog>
      )}
    </div>
  );
}

export function ArcadeMode({
  run,
  onExit,
  official: requestedOfficial,
}: {
  run: Run;
  onExit: () => void;
  official?: OfficialArcadeProps;
}) {
  const shellRef = useRef<HTMLElement>(null);
  const [input] = useState(() => new ArcadeInputController());
  const { status: controllerStatus, onFocusCapture } = useArcadeGamepad(
    shellRef,
    input,
  );
  const [official] = useState(() =>
    requestedOfficial
      ? {
          ...requestedOfficial,
          fixture: { ...requestedOfficial.fixture },
          teams: structuredClone(requestedOfficial.teams),
        }
      : undefined,
  );
  const [prepared] = useState(() =>
    official ? { teams: official.teams, error: null } : prepareArcadeTeams(run),
  );
  const [opponentId, setOpponentId] = useState(() =>
    official
      ? official.fixture.homeTeamId === 0
        ? official.fixture.awayTeamId
        : official.fixture.homeTeamId
      : (prepared.teams.find((team) => team.id !== 0)?.id ?? 1),
  );
  const [settings, setSettings] = useState(() =>
    readArcadeSettings(
      typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  );
  const [assets, setAssets] = useState<Map<number, HTMLImageElement>>(
      () => new Map(),
    ),
    [ready, setReady] = useState(false),
    [setupError, setSetupError] = useState<string | null>(null);
  const [match, setMatch] = useState<{
      state: ArcadeState;
      key: number;
    } | null>(null),
    sequence = useRef(0),
    audio = useRef<ArcadeAudio | null>(null);
  useEffect(
    () => () => {
      audio.current?.dispose();
      audio.current = null;
    },
    [],
  );
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [match?.key]);
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    const opponent = prepared.teams.find((team) => team.id === opponentId);
    if (!opponent || prepared.error) return;
    const ids = [
      ...Object.values(run.roster),
      ...Object.values(opponent.roster),
    ].filter((id): id is number => id !== null);
    loadArcadeAssets(ids)
      .then((loaded) => {
        if (!cancelled) {
          setAssets(loaded);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssets(new Map());
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [run.roster, opponentId, prepared]);
  const changeSettings = (next: ArcadeSettings) => {
    setSettings(next);
    saveArcadeSettings(next);
    if (!audio.current) audio.current = new ArcadeAudio();
    audio.current.setEnabled(next.audio);
  };
  const start = () => {
    const opponent = prepared.teams.find((team) => team.id === opponentId);
    const user = prepared.teams.find((team) => team.id === 0);
    if (!ready || !opponent) return;
    try {
      const random = new Uint32Array(1);
      if (official) random[0] = official.fixture.seed;
      else if (typeof crypto?.getRandomValues === "function")
        crypto.getRandomValues(random);
      else random[0] = Date.now();
      const state = createGame({
        teams: [
          {
            ...user,
            name: user?.name ?? "Kanto Basketball Club",
            roster: { ...(official ? user!.roster : run.roster) },
            development: user?.development,
            tactic: official ? user!.tactic : run.tactic,
            defense: official ? user!.defense : run.defense,
            coach: official ? user!.coach : run.coach,
          },
          {
            ...opponent,
            name: opponent.name,
            roster: { ...opponent.roster },
            development: opponent.development,
          },
        ],
        seed: random[0],
        ...((official ? user?.evaluationVersion : run.evaluationVersion) === 1
          ? { evaluationVersion: 1 as const }
          : {}),
        ...(!official || user?.typeMatchupsVersion === 1
          ? { typeMatchupsVersion: 1 as const }
          : {}),
        ...(!official || (user && abilitiesEnabled(user))
          ? { abilityVersion: 1 as const }
          : {}),
        ...(official ? { official: true } : {}),
      });
      if (!audio.current) audio.current = new ArcadeAudio();
      audio.current.setEnabled(settings.audio);
      setSetupError(null);
      setMatch({ state, key: ++sequence.current });
    } catch (error) {
      setSetupError(
        error instanceof Error
          ? error.message
          : "Unable to start this exhibition. Check the selected teams.",
      );
    }
  };
  return (
    <main
      className="arcade-shell"
      ref={shellRef}
      onFocusCapture={onFocusCapture}
    >
      <p className="arcade-controller-status" role="status">
        {controllerStatus}
      </p>
      {match ? (
        <ArcadeGame
          key={match.key}
          input={input}
          state={match.state}
          assets={assets}
          settings={settings}
          audio={audio.current!}
          onSettings={changeSettings}
          onRematch={start}
          onChangeOpponent={() => setMatch(null)}
          onExit={onExit}
          official={official}
        />
      ) : (
        <>
          {official ? (
            <OfficialArcadeSetup
              official={official}
              ready={ready}
              error={setupError ?? prepared.error}
              onStart={start}
              onExit={onExit}
            />
          ) : (
            <ArcadeSetupScreen
              roster={run.roster}
              teams={prepared.teams}
              error={setupError ?? prepared.error}
              opponentId={opponentId}
              onOpponent={(id) => {
                setOpponentId(id);
                setSetupError(null);
              }}
              ready={ready}
              onStart={start}
              onExit={onExit}
            />
          )}
          <div className="arcade-setup-settings">
            <ArcadeSettingsControls
              settings={settings}
              onChange={changeSettings}
            />
          </div>
        </>
      )}
    </main>
  );
}
