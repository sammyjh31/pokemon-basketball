import { expect, test } from "@playwright/test";

test("friends draft a complete local league, compare results, and restore without replacing solo progress", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
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
  const solo = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pokemon-basketball:v3")!),
  );
  await page.getByRole("button", { name: "Local league", exact: true }).click();
  await page.getByLabel("Franchise progression").selectOption("full-pool");
  await page.getByLabel("League size").selectOption("30");
  await page.getByLabel("Games per team").selectOption("82");
  await page.getByLabel("Playoff qualifiers").selectOption("16");
  await page.getByLabel("Playoff series").selectOption("7");
  await expect(page.getByText(/Generations I–IX are available/)).toBeVisible();
  await page.getByRole("button", { name: "Open matchup explorer" }).click();
  await page
    .getByRole("combobox", { name: "Shooter", exact: true })
    .selectOption("448");
  const shotChance = await page
    .getByLabel("Shot make probability", { exact: true })
    .textContent();
  await page.getByLabel("Shooter energy", { exact: true }).press("Home");
  await expect(
    page.getByLabel("Shot make probability", { exact: true }),
  ).not.toHaveText(shotChance!);
  await page.getByRole("button", { name: "Close matchup explorer" }).click();
  await page.getByLabel("Friend 1 name").fill("Sam");
  await page.getByLabel("Friend 2 name").fill("Alex");
  await page.getByLabel("Friend 1 team").selectOption("11");
  await page.getByLabel("Friend 2 team").selectOption("24");
  await expect(
    page.getByLabel("Include legendary and mythical Pokémon"),
  ).not.toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: `test-results/local-${info.project.name}-setup.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start snake draft" }).click();
  await page
    .getByRole("button", { name: "Draft Ash Ketchum", exact: true })
    .click();
  await page.getByRole("button", { name: "Draft Misty", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /On the clock: (Sam|Alex)/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/local-${info.project.name}-draft.png`,
    fullPage: true,
  });
  for (let i = 0; i < 16; i++) {
    if (i === 0)
      await page
        .getByRole("combobox", { name: "Filter by generation", exact: true })
        .selectOption("7");
    await page
      .getByRole("button", { name: /^View scouting for / })
      .first()
      .click();
    await page.getByRole("button", { name: /^Confirm pick:/ }).click();
    if (i === 4) {
      const before = await page
        .getByRole("heading", { name: /On the clock:/ })
        .textContent();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: /On the clock:/ }),
      ).toHaveText(before!);
    }
  }
  await expect(
    page.getByRole("heading", { name: "Set your lineup. Settle the debate." }),
  ).toBeVisible();
  const pg = await page.getByLabel("PG player", { exact: true }).inputValue();
  const center = await page
    .getByLabel("C player", { exact: true })
    .inputValue();
  await page.getByLabel("PG player", { exact: true }).selectOption(center);
  await expect(page.getByLabel("C player", { exact: true })).toHaveValue(pg);
  await expect(
    page.getByRole("combobox", { name: "Offense", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: /automatic coaching$/ }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Review friend", exact: true })
    .selectOption("24");
  await expect(
    page.getByRole("combobox", { name: "Defense", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: /automatic coaching$/ }),
  ).toBeVisible();
  const draft = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pokemon-basketball:local-league:v1")!),
  );
  expect(draft.version).toBe(2);
  expect(
    draft.picks.some(
      (p: { pokemonId: number; teamId: number }) =>
        p.pokemonId > 721 && [11, 24].includes(p.teamId),
    ),
  ).toBe(true);
  expect(draft.picks).toHaveLength(240);
  expect(
    new Set(draft.picks.map((p: { pokemonId: number }) => p.pokemonId)).size,
  ).toBe(240);
  expect(
    [draft.coaching[11].coach.id, draft.coaching[24].coach.id].sort(),
  ).toEqual(["ash", "misty"]);
  expect(
    new Set(draft.coaching.map((c: { coach: { id: string } }) => c.coach.id))
      .size,
  ).toBe(30);
  await page.getByRole("button", { name: "Simulate local season" }).click();
  const board = page.getByRole("table", { name: "Friends leaderboard" });
  await expect(board).toBeVisible({ timeout: 25000 });
  await expect(board.getByText("Sam", { exact: true })).toBeVisible();
  await expect(board.getByText("Alex", { exact: true })).toBeVisible();
  const results = await board.textContent();
  await page
    .getByRole("button", { name: "Team analysis", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "Team efficiency comparison" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Analyze team", exact: true })
    .selectOption("11");
  await page
    .getByRole("combobox", { name: "Rank teams by", exact: true })
    .selectOption("turnoverRate");
  await page
    .getByRole("region", { name: "Team analysis", exact: true })
    .screenshot({
      path: `test-results/local-${info.project.name}-analysis.png`,
    });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: `test-results/local-${info.project.name}-results.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(board).toBeVisible({ timeout: 25000 });
  await expect(board).toHaveText(results!);
  const playoffs = page.getByRole("region", { name: "Playoffs", exact: true });
  await expect(
    playoffs.getByLabel("Sam's playoff status", { exact: true }),
  ).toBeVisible();
  await expect(
    playoffs.getByLabel("Alex's playoff status", { exact: true }),
  ).toBeVisible();
  await expect(
    playoffs.getByLabel("Your playoff status", { exact: true }),
  ).toHaveCount(0);
  await playoffs
    .getByRole("button", { name: "Play next slate", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("pokemon-basketball:local-league:v1")!,
          ).playoffGames,
      ),
    )
    .toBe(8);
  await page.reload();
  await expect(playoffs.getByText(/8 playoff games played/)).toBeVisible({
    timeout: 25000,
  });
  await playoffs
    .getByRole("button", { name: "Finish round", exact: true })
    .click();
  await expect(
    playoffs.getByRole("button", { name: "Finish round", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  await playoffs
    .getByRole("button", { name: "Finish playoffs", exact: true })
    .click();
  const champion = playoffs.getByRole("article", {
    name: "Playoff champion",
    exact: true,
  });
  await expect(champion).toBeVisible({ timeout: 15000 });
  await expect(
    playoffs.getByRole("article", { name: "Finals MVP", exact: true }),
  ).toBeVisible();
  const championship = await champion.textContent();
  await expect(
    playoffs.getByRole("button", { name: "Finish playoffs", exact: true }),
  ).toBeDisabled();
  await expect(board).toHaveText(results!);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await playoffs.screenshot({
    path: `test-results/local-${info.project.name}-championship.png`,
  });
  await playoffs
    .getByRole("button", { name: /^View playoff box score:/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Game efficiency comparison" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Actual / expected shot points"),
  ).toHaveCount(2);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(champion).toHaveText(championship!, { timeout: 25000 });
  await page.getByRole("button", { name: "New local league" }).click();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(board).toBeVisible();
  await page.getByRole("button", { name: "Back to game" }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pokemon-basketball:v3")!),
    ),
  ).toEqual(solo);
  expect(errors).toEqual([]);
});
