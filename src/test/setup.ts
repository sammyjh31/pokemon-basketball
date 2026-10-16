import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { ONBOARDING_KEY } from "../components/onboarding";
afterEach(cleanup);
// Onboarding is a per-browser preference; every test starts as a returning
// player unless it clears the key to exercise first-run behaviour.
beforeEach(() => {
  // Node-environment suites (data catalog checks) have no browser storage.
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    ONBOARDING_KEY,
    JSON.stringify({ style: "skipped", checklistDone: true }),
  );
});
