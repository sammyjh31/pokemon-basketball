import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readArcadeSettings,
  saveArcadeSettings,
  ARCADE_SETTINGS_KEY,
} from "./settings";
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
describe("arcade preferences", () => {
  it("uses a reduced-motion preference and safe defaults for malformed storage", () => {
    localStorage.setItem(ARCADE_SETTINGS_KEY, "{broken");
    expect(readArcadeSettings(true)).toEqual({
      audio: false,
      reducedMotion: true,
    });
    localStorage.setItem(
      ARCADE_SETTINGS_KEY,
      JSON.stringify({ audio: "yes", reducedMotion: 1 }),
    );
    expect(readArcadeSettings(false)).toEqual({
      audio: false,
      reducedMotion: false,
    });
  });
  it("persists only arcade settings without touching the saved league", () => {
    localStorage.setItem("pokemon-basketball:v3", "season");
    saveArcadeSettings({ audio: true, reducedMotion: false });
    expect(readArcadeSettings(true)).toEqual({
      audio: true,
      reducedMotion: false,
    });
    expect(localStorage.getItem("pokemon-basketball:v3")).toBe("season");
  });
  it("keeps play available when browser storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readArcadeSettings(false)).toEqual({
      audio: false,
      reducedMotion: false,
    });
    expect(() =>
      saveArcadeSettings({ audio: true, reducedMotion: true }),
    ).not.toThrow();
  });
});
