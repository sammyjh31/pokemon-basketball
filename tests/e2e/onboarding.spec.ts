import { expect, test, type Page } from "@playwright/test";
import { asReturningPlayer } from "./returningPlayer";

const positions = ["PG", "SG", "SF", "PF", "C", "B1", "B2", "B3"];
// `DESIGN_SHOTS=1 npm run test:e2e -- onboarding` refreshes docs/design.
const shot = (page: Page, name: string, project: string) =>
  page.screenshot({
    path: process.env.DESIGN_SHOTS
      ? `docs/design/${name}-${project}.png`
      : `test-results/${project}-${name}.png`,
  });

test("first-run chooser sets a goal, is remembered and can be reopened", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const chooser = page.getByRole("dialog", {
    name: "How do you want to play?",
  });
  await expect(chooser).toBeVisible();
  await expect(chooser.getByText("After a season")).toBeVisible();
  await shot(page, "chooser", info.project.name);
  await chooser.getByRole("button", { name: /^Free build/ }).click();
  await expect(chooser).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lineup builder", pressed: true }),
  ).toBeVisible();
  const checklist = page.getByRole("region", { name: /GETTING STARTED/ });
  await expect(checklist).toContainText("0 of 3 done");
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(checklist).toBeVisible();
  await page
    .getByRole("navigation", { name: "On this page" })
    .getByRole("button", { name: "How to play" })
    .click();
  await expect(chooser).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(chooser).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "On this page" })
    .getByRole("button", { name: "Scouting guide" })
    .click();
  const guide = page.getByRole("dialog", {
    name: "Basketball brains. Pokémon stats.",
  });
  await expect(guide).toBeVisible();
  await guide.getByRole("button", { name: "Close guide" }).click();
  await expect(guide).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("a finished season continues into the offseason stepper", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await asReturningPlayer(page);
  await page.goto("/");
  await page
    .getByRole("region", { name: "Your team. Their game plan." })
    .getByRole("button", { name: /^Draft / })
    .first()
    .click();
  for (const p of positions) {
    await page
      .getByRole("button", { name: /^Draft / })
      .first()
      .click();
    await page
      .getByRole("button", { name: `${p} slot: Empty`, exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Simulate season", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip reveal" }).click();
  await page
    .getByRole("button", { name: "Finish playoffs", exact: true })
    .click({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Continue as franchise", exact: true })
    .click({ timeout: 90000 });
  await expect(page.getByText(/Franchise in progress\./)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lineup builder" }),
  ).toHaveCount(0);
  const steps = page.getByRole("list", { name: "Offseason steps" });
  await expect(steps).toBeVisible();
  const start = page.getByRole("button", { name: "Start season 2" });
  await expect(start).toBeDisabled();
  await expect(start).toHaveAccessibleDescription(/rookie draft/);
  await expect(steps.getByRole("listitem").first()).toContainText(
    "Status: Done",
  );
  await steps.scrollIntoViewIfNeeded();
  await shot(page, "offseason-stepper", info.project.name);
  await steps.getByRole("button", { name: "Open rookie draft" }).click();
  await expect(
    page.getByRole("button", { name: "Rookie draft", pressed: true }),
  ).toBeVisible();
});
