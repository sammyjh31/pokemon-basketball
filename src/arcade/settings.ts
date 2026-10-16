export interface ArcadeSettings {
  audio: boolean;
  reducedMotion: boolean;
}
export const ARCADE_SETTINGS_KEY = "pokemon-basketball:arcade-settings:v1";
export function readArcadeSettings(reducedMotion = false): ArcadeSettings {
  const fallback = { audio: false, reducedMotion };
  try {
    const value = JSON.parse(
      localStorage.getItem(ARCADE_SETTINGS_KEY) ?? "null",
    );
    return {
      audio: typeof value?.audio === "boolean" ? value.audio : fallback.audio,
      reducedMotion:
        typeof value?.reducedMotion === "boolean"
          ? value.reducedMotion
          : fallback.reducedMotion,
    };
  } catch {
    return fallback;
  }
}
export function saveArcadeSettings(settings: ArcadeSettings) {
  try {
    localStorage.setItem(ARCADE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Private browsing may deny storage; the in-memory preferences still work. */
  }
}
