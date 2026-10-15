import { expect, test, type Page } from "@playwright/test";
const positions = ["PG", "SG", "SF", "PF", "C"];
async function draftSpin(page: Page) {
  for (const p of positions) {
    await page
      .getByRole("button", { name: /^Draft / })
      .first()
      .click();
    await page
      .getByRole("button", { name: `${p} slot: Empty`, exact: true })
      .click();
  }
}
async function checkRecord(page: Page) {
  await expect(page.getByTestId("game-result")).toHaveCount(82);
  const text = await page.getByTestId("season-record").textContent();
  expect(
    text!
      .split("–")
      .map(Number)
      .reduce((a, b) => a + b),
  ).toBe(82);
}
test("full spin season, saved results, and reset cancellation", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "BUILD YOUR STARTING FIVE." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simulate season", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: `test-results/${info.project.name}-draft.png`,
    fullPage: true,
  });
  await draftSpin(page);
  await page
    .getByRole("button", { name: "Simulate season", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip reveal" }).click();
  await checkRecord(page);
  const before = await page.getByTestId("season-record").textContent();
  await page.reload();
  await checkRecord(page);
  await expect(page.getByTestId("season-record")).toHaveText(before!);
  await page.getByRole("button", { name: "New run", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await checkRecord(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-season.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("free draft search, swapping, filtering, and full season", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Free Draft", exact: true }).click();
  for (const [i, name] of [
    "Alakazam",
    "Mewtwo",
    "Dragonite",
    "Machamp",
    "Snorlax",
  ].entries()) {
    await page.getByRole("searchbox", { name: "Search Pokémon" }).fill(name);
    await page
      .getByRole("button", { name: `Draft ${name}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: `${positions[i]} slot: Empty`, exact: true })
      .click();
  }
  await page.getByRole("button", { name: "PG slot: Alakazam" }).click();
  await page.getByRole("button", { name: "C slot: Snorlax" }).click();
  await expect(
    page.getByRole("button", { name: "PG slot: Snorlax" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "C slot: Alakazam" }).click();
  await page.getByRole("button", { name: "PG slot: Snorlax" }).click();
  await page.getByRole("searchbox", { name: "Search Pokémon" }).fill("");
  await page.getByLabel("Filter by type").selectOption("fire");
  await expect(
    page.getByRole("button", { name: "Draft Charmander", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Draft Squirtle", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Simulate season", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip reveal" }).click();
  await checkRecord(page);
});
test("keyboard-only picks and reduced-motion results", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const p of positions) {
    const choice = page.getByRole("button", { name: /^Draft / }).first();
    await choice.focus();
    await page.keyboard.press("Enter");
    const slot = page.getByRole("button", {
      name: `${p} slot: Empty`,
      exact: true,
    });
    await slot.focus();
    await page.keyboard.press("Enter");
  }
  await page
    .getByRole("button", { name: "Simulate season", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await checkRecord(page);
  await expect(page.getByRole("button", { name: "Skip reveal" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "New run", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Keep playing" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Start new run" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("portraits render without external image requests", async ({ page }) => {
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
  const images = page.locator(".candidate-grid img");
  await expect(images).toHaveCount(4);
  await expect
    .poll(async () =>
      images.evaluateAll((nodes) =>
        nodes.every(
          (node) =>
            (node as HTMLImageElement).complete &&
            (node as HTMLImageElement).naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
});
