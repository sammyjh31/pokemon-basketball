import { expect, test } from "@playwright/test";
import { asReturningPlayer } from "./returningPlayer";
test.beforeEach(({ page }) => asReturningPlayer(page));

test("chooses all seven pools, confirms draft resets and restores a later-generation lineup", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const selector = page.getByRole("combobox", { name: "Challenge generation" });
  await expect(selector).toHaveValue("all");
  const savedRun = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("pokemon-basketball:v3")!).run,
    );
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
    await expect.poll(async () => (await savedRun()).draftPool).toBe(pool);
    const run = await savedRun();
    expect(run.offerIds).toHaveLength(4);
    expect(run.offerIds.every((id: number) => id >= first && id <= last)).toBe(
      true,
    );
  }
  await selector.selectOption("7");
  await page
    .getByRole("region", { name: "Your team. Their game plan." })
    .getByRole("button", { name: /^Draft / })
    .first()
    .click();
  await page
    .getByRole("button", { name: /^Draft / })
    .first()
    .click();
  await page
    .getByRole("button", { name: "PG slot: Empty", exact: true })
    .click();
  const before = await savedRun();
  await selector.selectOption("3");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(selector).toHaveValue("7");
  expect((await savedRun()).roster).toEqual(before.roster);
  await selector.selectOption("3");
  await page.getByRole("button", { name: "Restart draft" }).click();
  await expect.poll(async () => (await savedRun()).draftPool).toBe(3);
  expect((await savedRun()).coach).toEqual(before.coach);
  expect((await savedRun()).roster.PG).toBeNull();
  await selector.selectOption("7");
  await page.getByRole("button", { name: "Re-roll · 2 left" }).click();
  await expect.poll(async () => (await savedRun()).rerollsLeft).toBe(1);
  expect(
    (await savedRun()).offerIds.every((id: number) => id >= 722 && id <= 809),
  ).toBe(true);
  await page.reload();
  await expect(selector).toHaveValue("7");
  expect((await savedRun()).rerollsLeft).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("imports and reloads a shared Gen VII lineup in the builder", async ({
  page,
}) => {
  await page.goto("/?lineup=722,723,724,725,726,727,728,729&pool=all");
  const coach = page.getByRole("region", {
    name: "Your team. Their game plan.",
  });
  await coach
    .getByRole("button", { name: /^Draft / })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Simulate season", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("pokemon-basketball:v3")!).run
            .draftPool,
      ),
    )
    .toBe("all");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Simulate season", exact: true }),
  ).toBeEnabled();
  const run = await page.evaluate(
    () => JSON.parse(localStorage.getItem("pokemon-basketball:v3")!).run,
  );
  expect(Object.values(run.roster)).toEqual([
    722, 723, 724, 725, 726, 727, 728, 729,
  ]);
  expect(run.draftPool).toBe("all");
});
