import { expect, test } from "@playwright/test";
import { asReturningPlayer } from "./returningPlayer";
test.beforeEach(({ page }) => asReturningPlayer(page));

test("builds from every generation, searches later species and safely changes pools", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Lineup builder", exact: true })
    .click();
  const selector = page.getByRole("combobox", { name: "Lineup generation" });
  await expect(selector).toHaveValue("all");
  await selector.selectOption("7");
  await page
    .getByRole("region", { name: "Your team. Their game plan." })
    .getByRole("button", { name: /^Draft / })
    .first()
    .click();
  const search = page.getByRole("searchbox", { name: "Search Pokémon" });
  await search.fill("Rowlet");
  await page.getByRole("button", { name: "Draft Rowlet", exact: true }).click();
  await page
    .getByRole("button", { name: "PG slot: Empty", exact: true })
    .click();
  await search.fill("");
  await page.getByRole("button", { name: "Auto-fill bench" }).click();
  const savedRun = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("pokemon-basketball:v3")!).run,
    );
  const before = await savedRun();
  expect(before.roster.PG).toBe(722);
  expect(
    [before.roster.B1, before.roster.B2, before.roster.B3].every(
      (id: number) => id >= 722 && id <= 809,
    ),
  ).toBe(true);
  await selector.selectOption("1");
  await expect(page.getByRole("dialog")).toContainText("Rowlet");
  await page.getByRole("button", { name: "Keep playing" }).click();
  expect((await savedRun()).roster).toEqual(before.roster);
  await selector.selectOption("all");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await savedRun()).roster).toEqual(before.roster);
  await selector.selectOption("1");
  await page.getByRole("button", { name: "Change pool" }).click();
  expect(
    Object.values((await savedRun()).roster).every((id) => id === null),
  ).toBe(true);
  expect((await savedRun()).coach).toEqual(before.coach);
  for (const [pool, first, last] of [
    [1, 1, 151],
    [2, 152, 251],
    [3, 252, 386],
    [4, 387, 493],
    [5, 494, 649],
    [6, 650, 721],
    [7, 722, 809],
    ["all", 1, 809],
  ] as const) {
    await selector.selectOption(String(pool));
    await page.getByRole("button", { name: "Randomize", exact: true }).click();
    const ids = Object.values((await savedRun()).roster) as number[];
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(ids.every((id) => id >= first && id <= last)).toBe(true);
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
  }
  await selector.selectOption("7");
  await page.getByRole("button", { name: "Randomize", exact: true }).click();
  const final = await savedRun();
  await page.reload();
  await expect(selector).toHaveValue("7");
  expect((await savedRun()).roster).toEqual(final.roster);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("shares the selected generation, including a Gen I-only lineup", async ({
  page,
}) => {
  await page.goto("/?lineup=25,26,27,28,29&pool=1");
  const selector = page.getByRole("combobox", { name: "Lineup generation" });
  await expect(selector).toHaveValue("1");
  await page
    .getByRole("region", { name: "Your team. Their game plan." })
    .getByRole("button", { name: /^Draft / })
    .first()
    .click();
  // Exercise the visible manual-copy fallback without depending on browser permissions.
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  const link = await page
    .getByRole("textbox", { name: "Lineup link" })
    .inputValue();
  expect(new URL(link).searchParams.get("pool")).toBe("1");
  await page.reload();
  await expect(selector).toHaveValue("1");
  await page.goto("/?lineup=722,723,724,725,726,727,728,729&pool=7");
  await page.getByRole("button", { name: "Load lineup", exact: true }).click();
  await expect(selector).toHaveValue("7");
  await page.reload();
  await expect(selector).toHaveValue("7");
});
