import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "../game/arcade/setup";
import type { ArcadeState } from "../game/arcade/types";
import { ArcadeAudio } from "../arcade/audio";
import { useArcade } from "./useArcade";
vi.mock("../arcade/renderer", () => ({
  drawArcade: () => {},
  loadArcadeAssets: async () => new Map(),
}));
const roster = (start: number) => ({
  PG: start,
  SG: start + 1,
  SF: start + 2,
  PF: start + 3,
  C: start + 4,
  B1: start + 5,
  B2: start + 6,
  B3: start + 7,
});
const game = () =>
  createGame({
    teams: [
      { name: "Home", roster: roster(1) },
      { name: "Away", roster: roster(20) },
    ],
    seed: 42,
  });
let frames: Map<number, FrameRequestCallback>,
  nextId = 0;
const assets = new Map<number, HTMLImageElement>(),
  settings = { audio: false, reducedMotion: false };
function Harness({ state }: { state: ArcadeState }) {
  const runtime = useArcade(state, assets, settings, new ArcadeAudio());
  return (
    <div ref={runtime.gameplayRef}>
      <canvas aria-label="Court" ref={runtime.canvasRef} tabIndex={0} />
      <button onClick={runtime.resume}>Resume</button>
      <output>{runtime.snapshot.paused ? "Paused" : "Playing"}</output>
    </div>
  );
}
function frame(time: number) {
  act(() => {
    const queued = [...frames.values()];
    frames.clear();
    queued.forEach((callback) => callback(time));
  });
}
beforeEach(() => {
  frames = new Map();
  nextId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextId;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform: () => {},
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("arcade runtime", () => {
  it("bounds simulation catch-up and keeps a single loop after rerender and teardown", () => {
    const state = game();
    state.phase = "live";
    const { rerender, unmount } = render(<Harness state={state} />);
    frame(0);
    frame(1000);
    expect(state.clock).toBeLessThan(60);
    expect(state.clock).toBeGreaterThan(59.8);
    rerender(<Harness state={state} />);
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });
  it("restores gameplay focus after the paused court is no longer inert", () => {
    const state = game();
    function FocusHarness() {
      const runtime = useArcade(state, assets, settings, new ArcadeAudio());
      return (
        <>
          <div ref={runtime.gameplayRef} inert={runtime.snapshot.paused}>
            <canvas
              aria-label="Focus court"
              ref={runtime.canvasRef}
              tabIndex={0}
            />
          </div>
          <button onClick={runtime.pause}>Pause focus game</button>
          <button onClick={runtime.resume}>Resume focus game</button>
        </>
      );
    }
    const nativeFocus = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      if (!this.closest("[inert]")) nativeFocus.call(this, options);
    });
    render(<FocusHarness />);
    act(() => screen.getByText("Pause focus game").focus());
    fireEvent.click(screen.getByText("Pause focus game"));
    fireEvent.click(screen.getByText("Resume focus game"));
    expect(screen.getByLabelText("Focus court")).toHaveFocus();
  });
  it("captures keys only with court focus and cancels an unreleased shot when focus is lost", () => {
    const state = game();
    state.phase = "live";
    render(<Harness state={state} />);
    const canvas = screen.getByLabelText("Court");
    act(() => canvas.focus());
    fireEvent.keyDown(canvas, { code: "KeyJ" });
    frame(0);
    frame(20);
    expect(state.players[0].charge).not.toBeNull();
    fireEvent.blur(window);
    expect(state.paused).toBe(true);
    expect(state.players[0].charge).toBeNull();
    fireEvent.click(screen.getByText("Resume"));
    frame(1000);
    frame(1020);
    expect(state.players[0].stats.fga).toBe(0);
    expect(state.paused).toBe(false);
  });
});
