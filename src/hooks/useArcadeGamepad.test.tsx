import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRef, useState } from "react";
import { ArcadeInputController } from "../arcade/input";
import { useArcadeGamepad } from "./useArcadeGamepad";
import { useArcade } from "./useArcade";
import { ArcadeAudio } from "../arcade/audio";
import { createGame } from "../game/arcade/setup";
vi.mock("../arcade/renderer", () => ({ drawArcade: () => {} }));
let frames: Map<number, FrameRequestCallback>,
  seq: number,
  pads: (Gamepad | null)[],
  now: number;
function pad(buttons: number[] = [], index = 0, mapping = "standard") {
  return {
    index,
    id: `Xbox ${index}`,
    mapping,
    connected: true,
    axes: [0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: buttons.includes(i),
      value: buttons.includes(i) ? 1 : 0,
    })),
  } as unknown as Gamepad;
}
function tick(buttons: number[] = [], index = 0) {
  pads = [null, pad(buttons, index)];
  frame();
}
function frame() {
  act(() => {
    now += 20;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((cb) => cb(now));
  });
}
beforeEach(() => {
  frames = new Map();
  seq = 0;
  pads = [];
  now = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.set(++seq, cb);
    return seq;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    { width: 100, height: 30 },
  ] as unknown as DOMRectList);
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => pads,
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform() {},
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (navigator as Partial<Navigator>).getGamepads;
});
it("navigates scoped menus, changes select options, and activates A only once", () => {
  const start = vi.fn();
  function Menu() {
    const ref = useRef<HTMLDivElement>(null),
      [input] = useState(() => new ArcadeInputController());
    const status = useArcadeGamepad(ref, input);
    const [opponent, setOpponent] = useState("one");
    return (
      <div ref={ref}>
        <p>{status}</p>
        <button>Back to roster</button>
        <button className="arcade-primary" onClick={start}>
          Tip off
        </button>
        <select
          aria-label="Opponent"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
        >
          <option value="one">One</option>
          <option value="two">Two</option>
        </select>
        <button disabled>Unavailable</button>
      </div>
    );
  }
  const { unmount } = render(<Menu />);
  tick();
  tick([0]);
  tick([0]);
  expect(start).toHaveBeenCalledTimes(1);
  tick();
  tick([13]);
  expect(screen.getByLabelText("Opponent")).toHaveFocus();
  tick();
  tick([15]);
  expect(screen.getByLabelText("Opponent")).toHaveValue("two");
  expect(screen.getByText(/Controller connected/)).toBeInTheDocument();
  unmount();
  expect(frames.size).toBe(0);
});
it("plays through the real runtime, pauses on Menu/disconnect, and neutralizes held controls on resume", () => {
  const roster = (n: number) => ({
    PG: n,
    SG: n + 1,
    SF: n + 2,
    PF: n + 3,
    C: n + 4,
    B1: n + 5,
    B2: n + 6,
    B3: n + 7,
  });
  const state = createGame({
    teams: [
      { name: "You", roster: roster(1) },
      { name: "CPU", roster: roster(20) },
    ],
    seed: 42,
  });
  state.phase = "live";
  const assets = new Map<number, HTMLImageElement>(),
    audio = new ArcadeAudio();
  function Game() {
    const ref = useRef<HTMLDivElement>(null),
      [input] = useState(() => new ArcadeInputController());
    const status = useArcadeGamepad(ref, input);
    const runtime = useArcade(
      state,
      assets,
      { audio: false, reducedMotion: false },
      audio,
      input,
    );
    return (
      <div ref={ref}>
        <p>{status}</p>
        <button data-gamepad-pause onClick={runtime.pause}>
          Pause
        </button>
        <div
          data-gamepad-play
          ref={runtime.gameplayRef}
          inert={runtime.snapshot.paused}
        >
          <canvas aria-label="Court" ref={runtime.canvasRef} tabIndex={0} />
        </div>
        {runtime.snapshot.paused && (
          <div role="dialog">
            <button data-gamepad-resume onClick={runtime.resume}>
              Resume
            </button>
          </div>
        )}
      </div>
    );
  }
  render(<Game />);
  tick();
  tick([2]);
  tick([2]);
  expect(state.players[0].charge).not.toBeNull();
  tick();
  expect(state.players[0].stats.fga).toBe(1);
  tick([9]);
  expect(state.paused).toBe(true);
  tick([9]);
  expect(state.paused).toBe(true);
  tick();
  tick([9]);
  expect(state.paused).toBe(false);
  tick([2]);
  expect(state.players[0].charge).toBeNull();
  tick();
  tick([2]);
  pads = [];
  frame();
  expect(state.paused).toBe(true);
  expect(state.players.every((p) => p.charge === null)).toBe(true);
  expect(screen.getByText(/Controller disconnected/)).toBeInTheDocument();
  fireEvent.click(screen.getByText("Resume"));
  tick([2]);
  expect(state.players.every((p) => p.charge === null)).toBe(true);
});
it("handles missing/blocked APIs and ignores nonstandard mappings without breaking keyboard play", () => {
  function Status() {
    const ref = useRef<HTMLDivElement>(null),
      [input] = useState(() => new ArcadeInputController());
    const status = useArcadeGamepad(ref, input);
    return <div ref={ref}>{status}</div>;
  }
  render(<Status />);
  pads = [pad([], 0, "")];
  frame();
  expect(screen.getByText(/not mapped/)).toBeInTheDocument();
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => {
      throw new Error("blocked");
    },
  });
  frame();
  expect(screen.getByText(/unavailable/)).toBeInTheDocument();
});
