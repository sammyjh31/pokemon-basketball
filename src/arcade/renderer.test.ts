import { afterEach, describe, expect, it, vi } from "vitest";
import { loadArcadeAssets, projectCourt, recentRimContact } from "./renderer";
import type { Ball } from "../game/arcade/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("arcade court projection", () => {
  it.each([
    [1200, 675],
    [375, 220],
    [740, 260],
  ])(
    "keeps both baskets and floor corners in a %s × %s viewport",
    (width, height) => {
      for (const [x, y, z] of [
        [0, 0, 0],
        [28, 0, 0],
        [0, 15, 0],
        [28, 15, 0],
        [1.5, 7.5, 3.05],
        [26.5, 7.5, 3.05],
      ]) {
        const point = projectCourt(x, y, z, width, height);
        expect(point.x).toBeGreaterThan(0);
        expect(point.x).toBeLessThan(width);
        expect(point.y).toBeGreaterThan(0);
        expect(point.y).toBeLessThan(height);
      }
    },
  );

  it("raises airborne objects without changing their floor position or horizontal alignment", () => {
    const ground = projectCourt(14, 7.5, 0, 960, 540);
    const jump = projectCourt(14, 7.5, 2, 960, 540);
    const near = projectCourt(14, 13, 0, 960, 540);
    expect(jump.x).toBe(ground.x);
    expect(jump.y).toBeLessThan(ground.y);
    expect(near.y).toBeGreaterThan(ground.y);
  });
});

describe("rim contact feedback", () => {
  const missedBall: Ball = {
    mode: "loose",
    x: 26,
    y: 7,
    z: 0.7,
    owner: null,
    from: 0,
    target: null,
    start: { x: 20, y: 7.5, z: 1.5 },
    end: { x: 26.5, y: 7.5, z: 2.6 },
    travel: 1,
    duration: 1,
    shotValue: 2,
    made: false,
    dunk: false,
    lob: false,
    reboundOf: 0,
    lastTouch: 0,
  };
  it("finishes score effects while the live clock is stopped for an inbound", () => {
    const state = {
      period: 1,
      elapsed: 4,
      tick: 300,
      events: [
        {
          id: 1,
          kind: "score" as const,
          team: 0 as const,
          player: 0,
          time: 4,
          tick: 240,
        },
      ],
      ball: { ...missedBall, mode: "held" as const },
    };
    expect(recentRimContact(state, 1)).toBeNull();
  });
  it("only reacts on the scoring basket and follows the halftime direction change", () => {
    const state = {
      period: 1,
      elapsed: 4.1,
      events: [
        { id: 1, kind: "score" as const, team: 0 as const, player: 0, time: 4 },
      ],
      ball: { ...missedBall, mode: "held" as const },
    };
    expect(recentRimContact(state, 0)).toBeNull();
    expect(recentRimContact(state, 1)?.age).toBeCloseTo(0.1);
    state.period = 3;
    expect(recentRimContact(state, 1)).toBeNull();
    expect(recentRimContact(state, 0)?.age).toBeCloseTo(0.1);
  });

  it("reacts to a completed miss but not an airborne shot or a blocked ball", () => {
    const state = {
      period: 1,
      elapsed: 4.1,
      events: [
        { id: 1, kind: "shot" as const, team: 0 as const, player: 0, time: 3 },
      ],
      ball: { ...missedBall },
    };
    expect(recentRimContact(state, 1)?.age).toBeCloseTo(0.1);
    state.ball.mode = "shot";
    expect(recentRimContact(state, 1)).toBeNull();
    state.ball.mode = "loose";
    state.ball.end = { x: 24, y: 7.5, z: 0 };
    expect(recentRimContact(state, 1)).toBeNull();
  });
});

describe("arcade sprite loading", () => {
  it("keeps successful sprites and settles failed and stalled loads instead of blocking tipoff", async () => {
    vi.useFakeTimers();
    class TestImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(value: string) {
        if (value === "/pokemon-pixel/25.png")
          setTimeout(() => this.onload?.(), 5);
        if (value === "/pokemon-pixel/26.png")
          setTimeout(() => this.onerror?.(), 5);
      }
    }
    vi.stubGlobal("Image", TestImage);
    const loading = loadArcadeAssets([25, 26, 27, 25]);
    await vi.runAllTimersAsync();
    const assets = await loading;
    expect([...assets.keys()]).toEqual([25]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns a usable fallback-only asset map if image construction is unavailable", async () => {
    vi.stubGlobal(
      "Image",
      class {
        constructor() {
          throw new Error("Images disabled");
        }
      },
    );
    await expect(loadArcadeAssets([25])).resolves.toEqual(new Map());
  });
});
