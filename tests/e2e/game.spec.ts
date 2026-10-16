import { expect, test, type Page } from "@playwright/test";
async function chooseCoach(page: Page) {
  await page
    .getByRole("region", { name: "Your team. Their game plan." })
    .getByRole("button", { name: /^Draft / })
    .first()
    .click();
}
const positions = ["PG", "SG", "SF", "PF", "C", "B1", "B2", "B3"];
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
  await chooseCoach(page);
  await expect(
    page.getByRole("heading", { name: "82–0 Challenge" }),
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
  await chooseCoach(page);
  await page
    .getByRole("button", { name: "Lineup builder", exact: true })
    .click();
  await chooseCoach(page);
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
  await page.getByRole("button", { name: "Auto-fill bench" }).click();
  await page
    .getByRole("button", { name: "Simulate season", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip reveal" }).click();
  await checkRecord(page);
});
test("keyboard-only picks and reduced-motion results", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await chooseCoach(page);
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
  await chooseCoach(page);
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

test("informative text and type labels meet normal-text contrast", async ({
  page,
}) => {
  const checkContrast = async () => {
    const failures = await page.evaluate(() => {
      const selectors = [
        ".eyebrow",
        ".rating-caption",
        ".team-ratings strong small",
        ".count-chip",
        ".season-empty p",
        ".schedule-table th",
        ".game-score small",
        ".mode-tabs button:not([aria-pressed=true])",
        ".court-instruction",
        ".text-button",
        ".legend-toggle",
        ".card-top",
        ".best-position",
        ".card-stats",
        ".card-select",
        ".draft-footnote",
        ".types span",
        ".preview-heading > span",
        ".attribute-list",
        ".season-heading p",
        ".opponent-name small",
        ".odds",
        ".pending-game",
        ".game-number",
        ".season-record > span:last-child",
        ".season-meta > span:last-child",
        ".mvp span",
        ".personal-best > span:last-child",
        ".footer-brand span",
        "footer p",
      ];
      const rgba = (s: string): number[] => {
        const nums = s.match(/[\d.]+/g)!.map(Number);
        return [nums[0], nums[1], nums[2], nums[3] ?? 1];
      };
      const over = (front: number[], back: number[]) =>
        [0, 1, 2]
          .map((i) => front[i] * front[3] + back[i] * (1 - front[3]))
          .concat(1);
      const luminance = (rgb: number[]) =>
        rgb
          .slice(0, 3)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      return [...document.querySelectorAll<HTMLElement>(selectors.join(","))]
        .filter((el) => el.getClientRects().length > 0)
        .flatMap((el) => {
          const chain: HTMLElement[] = [];
          let parent: HTMLElement | null = el;
          while (parent) {
            chain.unshift(parent);
            parent = parent.parentElement;
          }
          let bg = [255, 255, 255, 1];
          for (const node of chain)
            bg = over(rgba(getComputedStyle(node).backgroundColor), bg);
          const text = over(rgba(getComputedStyle(el).color), bg),
            a = luminance(text),
            b = luminance(bg),
            ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          return ratio < 4.5
            ? [
                {
                  text: el.textContent?.trim().slice(0, 45),
                  className: el.className,
                  color: getComputedStyle(el).color,
                  ratio: Number(ratio.toFixed(2)),
                },
              ]
            : [];
        });
    });
    expect(failures).toEqual([]);
  };
  await page.goto("/");
  await chooseCoach(page);
  await page
    .getByRole("button", { name: "Lineup builder", exact: true })
    .click();
  await chooseCoach(page);
  await page.getByRole("searchbox", { name: "Search Pokémon" }).fill("Pikachu");
  await page
    .getByRole("button", { name: "Draft Pikachu", exact: true })
    .click();
  await checkContrast();
  await page.getByRole("searchbox", { name: "Search Pokémon" }).fill("");
  await checkContrast();
  await page
    .getByRole("button", { name: "PG slot: Empty", exact: true })
    .click();
  for (const [i, name] of [
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
      .getByRole("button", {
        name: `${positions[i + 1]} slot: Empty`,
        exact: true,
      })
      .click();
  }
  await page.getByRole("button", { name: "Auto-fill bench" }).click();
  await page
    .getByRole("button", { name: "Simulate season", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip reveal" }).click();
  await checkContrast();
});
