import type { Page } from "@playwright/test";
/** Mirrors src/components/onboarding.ts: start as a player who has onboarded. */
export const ONBOARDING_KEY = "pokemon-basketball:onboarding:v1";
export const asReturningPlayer = (page: Page) =>
  page.addInitScript((key) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({ style: "skipped", checklistDone: true }),
      );
  }, ONBOARDING_KEY);
