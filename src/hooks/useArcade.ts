import { useCallback, useEffect, useRef, useState } from "react";
import { ArcadeInputController } from "../arcade/input";
import { drawArcade } from "../arcade/renderer";
import type { ArcadeAudio } from "../arcade/audio";
import type { ArcadeSettings } from "../arcade/settings";
import {
  cancelSubstitution,
  continuePeriod,
  queueSubstitution,
  setPaused,
  stepGame,
} from "../game/arcade/engine";
import type { ArcadeState } from "../game/arcade/types";
const STEP = 1 / 60;
function snapshotOf(state: ArcadeState): ArcadeState {
  return {
    ...state,
    score: [...state.score],
    fire: [...state.fire],
    streak: [...state.streak],
    players: state.players.map((player) => ({
      ...player,
      stats: { ...player.stats },
    })),
    pendingSubs: state.pendingSubs.map((sub) => ({ ...sub })),
    events: state.events.slice(-16),
    ball: { ...state.ball },
  };
}

export function useArcade(
  state: ArcadeState,
  assets: Map<number, HTMLImageElement>,
  settings: ArcadeSettings,
  audio: ArcadeAudio,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    gameplayRef = useRef<HTMLDivElement>(null);
  const [input] = useState(() => new ArcadeInputController()),
    [snapshot, setSnapshot] = useState(() => snapshotOf(state)),
    [error, setError] = useState<string | null>(null);
  const options = useRef({ settings, audio }),
    resetTime = useRef(true);
  options.current = { settings, audio };
  const publish = useCallback(() => setSnapshot(snapshotOf(state)), [state]);
  const pause = useCallback(() => {
    if (state.phase === "final") return;
    input.clear();
    setPaused(state, true);
    resetTime.current = true;
    publish();
  }, [state, input, publish]);
  const resume = useCallback(() => {
    input.clear();
    if (state.phase === "break") continuePeriod(state);
    setPaused(state, false);
    resetTime.current = true;
    publish();
  }, [state, input, publish]);
  const queue = useCallback(
    (outId: number, inId: number) => {
      const accepted = queueSubstitution(state, outId, inId);
      publish();
      return accepted;
    },
    [state, publish],
  );
  const cancel = useCallback(
    (outId: number) => {
      cancelSubstitution(state, outId);
      publish();
    },
    [state, publish],
  );
  useEffect(() => {
    if (
      !snapshot.paused &&
      snapshot.phase !== "break" &&
      snapshot.phase !== "final"
    )
      canvasRef.current?.focus({ preventScroll: true });
  }, [snapshot.paused, snapshot.phase]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let context: CanvasRenderingContext2D | null;
    try {
      context = canvas.getContext("2d");
    } catch {
      context = null;
    }
    if (!context) {
      setError(
        "The court could not start. Your browser needs Canvas 2D support.",
      );
      setPaused(state, true);
      return;
    }
    let frameId = 0,
      previous: number | null = null,
      accumulator = 0,
      lastSnapshot = 0,
      eventCursor = state.events.length,
      alive = true,
      width = 960,
      height = 540;
    const ctx = context;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width || 960);
      height = Math.max(1, rect.height || 540);
      const ratio = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const fail = (failure: unknown) => {
      alive = false;
      input.clear();
      setPaused(state, true);
      setError(
        failure instanceof Error
          ? `The court stopped: ${failure.message}`
          : "The court stopped unexpectedly. Return to your roster to try again.",
      );
    };
    try {
      resize();
    } catch (failure) {
      fail(failure);
      return;
    }
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            try {
              resize();
            } catch (failure) {
              fail(failure);
            }
          })
        : null;
    observer?.observe(canvas);
    window.addEventListener("resize", resize);
    const canPlay = () =>
      !state.paused && state.phase !== "break" && state.phase !== "final";
    const ownsFocus = () =>
      gameplayRef.current?.contains(document.activeElement) ?? false;
    const keydown = (event: KeyboardEvent) => {
      if (!ownsFocus() || !canPlay()) return;
      if (input.keyDown(event.code, event.repeat)) event.preventDefault();
      if (input.consumePause()) pause();
    };
    const keyup = (event: KeyboardEvent) => input.keyUp(event.code);
    const visibility = () => {
      if (document.hidden) pause();
    };
    const focusout = (event: FocusEvent) => {
      if (
        gameplayRef.current?.contains(event.target as Node) &&
        !gameplayRef.current.contains(event.relatedTarget as Node | null) &&
        canPlay()
      )
        pause();
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("focusout", focusout);
    const frame = (now: number) => {
      if (!alive) return;
      try {
        if (resetTime.current) {
          previous = now;
          accumulator = 0;
          resetTime.current = false;
        }
        const elapsed =
          previous === null
            ? 0
            : Math.min(Math.max(0, (now - previous) / 1000), STEP * 5);
        previous = now;
        const previousPhase = state.phase;
        if (canPlay()) {
          accumulator = Math.min(accumulator + elapsed, STEP * 5);
          if (input.consumeShotCancellation()) {
            const paused = state.paused;
            setPaused(state, true);
            setPaused(state, paused);
          }
          let steps = 0;
          while (accumulator + 1e-9 >= STEP && steps < 5) {
            stepGame(state, input.read(), STEP);
            accumulator -= STEP;
            steps++;
          }
        } else accumulator = 0;
        if (
          previousPhase !== state.phase &&
          (state.phase === "break" || state.phase === "final")
        )
          input.clear();
        for (const event of state.events.slice(eventCursor))
          options.current.audio.play(event);
        eventCursor = state.events.length;
        drawArcade(
          ctx,
          state,
          assets,
          width,
          height,
          options.current.settings.reducedMotion,
        );
        if (now - lastSnapshot >= 100 || previousPhase !== state.phase) {
          publish();
          lastSnapshot = now;
        }
        if (state.phase !== "final") frameId = requestAnimationFrame(frame);
      } catch (failure) {
        fail(failure);
      }
    };
    frameId = requestAnimationFrame(frame);
    canvas.focus({ preventScroll: true });
    return () => {
      alive = false;
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      input.clear();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("focusout", focusout);
    };
  }, [state, assets, input, pause, publish]);
  return {
    canvasRef,
    gameplayRef,
    snapshot,
    error,
    input,
    pause,
    resume,
    queue,
    cancel,
  };
}
