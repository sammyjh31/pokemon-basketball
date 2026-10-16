import { afterEach, describe, expect, it, vi } from "vitest";
import { ArcadeAudio } from "./audio";
import type { ArcadeEvent } from "../game/arcade/types";

const score: ArcadeEvent = {
  id: 1,
  kind: "score",
  team: 0,
  player: 0,
  value: 2,
  time: 0,
};
afterEach(() => vi.unstubAllGlobals());

describe("optional arcade audio", () => {
  it("does not request an audio context until the caller explicitly enables sound", () => {
    let attempts = 0;
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          attempts++;
          throw new Error("Audio unavailable");
        }
      },
    );
    const audio = new ArcadeAudio();
    audio.play(score);
    audio.setEnabled(false);
    expect(attempts).toBe(0);
    expect(() => audio.setEnabled(true)).not.toThrow();
    expect(attempts).toBe(1);
    expect(() => audio.play(score)).not.toThrow();
    expect(attempts).toBe(1);
    expect(() => audio.dispose()).not.toThrow();
  });

  it("remains silent and usable when Web Audio is absent or after disposal", () => {
    vi.stubGlobal("AudioContext", undefined);
    const audio = new ArcadeAudio();
    expect(() => audio.setEnabled(true)).not.toThrow();
    expect(() => audio.play(score)).not.toThrow();
    audio.dispose();
    let attempts = 0;
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          attempts++;
        }
      },
    );
    audio.setEnabled(true);
    audio.play(score);
    expect(attempts).toBe(0);
  });
});
