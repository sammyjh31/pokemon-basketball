import type { StorageLike } from "../game/persistence";

/** Interface preferences only; kept apart from the validated game save. */
export const ONBOARDING_KEY = "pokemon-basketball:onboarding:v1";
export type PlayStyle = "challenge" | "free" | "franchise" | "local";
export const PLAY_STYLES: PlayStyle[] = [
  "challenge",
  "free",
  "franchise",
  "local",
];
export interface Onboarding {
  /** Set once the player has chosen (or dismissed) the first-run chooser. */
  style?: PlayStyle | "skipped";
  checklistDone?: boolean;
}

export const browserOnboardingStorage: StorageLike = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};

export function readOnboarding(storage: StorageLike): Onboarding {
  try {
    const raw = JSON.parse(storage.getItem(ONBOARDING_KEY) ?? "{}");
    if (!raw || typeof raw !== "object") return {};
    return {
      style:
        PLAY_STYLES.includes(raw.style) || raw.style === "skipped"
          ? raw.style
          : undefined,
      checklistDone: raw.checklistDone === true,
    };
  } catch {
    return {};
  }
}

export function writeOnboarding(storage: StorageLike, value: Onboarding) {
  try {
    storage.setItem(ONBOARDING_KEY, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota: onboarding simply shows again next visit.
  }
}
