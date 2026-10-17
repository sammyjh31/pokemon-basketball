import { expect, test } from "@playwright/test";
import { asReturningPlayer } from "./returningPlayer";
test.beforeEach(({ page }) => asReturningPlayer(page));

for (const mode of ["generational", "full-pool"] as const) {
  test(`${mode} friends league plays two seasons, inspects events and restores history`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const save = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("pokemon-basketball:local-league:v1")!),
      );
    await page.goto("/#local-league");
    await page.getByLabel("Franchise progression").selectOption(mode);
    await page.getByLabel("League size").selectOption("4");
    await page.getByLabel("Games per team").selectOption("14");
    await page.getByLabel("Playoff series").selectOption("1");
    await expect(
      page.getByLabel("Species abilities", { exact: true }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Start snake draft" }).click();
    await page
      .getByRole("button", { name: "Draft Ash Ketchum", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Draft Misty", exact: true })
      .click();
    await page.getByText("Advanced scouting", { exact: true }).click();
    await page.getByText(/Draft recommendations for/).click();
    await expect(page.getByText(/Based on open roles/)).toBeVisible();
    for (let i = 0; i < 16; i++) {
      if (i === 0 && mode === "full-pool")
        await page.getByLabel("Filter by generation").selectOption("9");
      await page
        .getByRole("button", { name: /^View scouting for / })
        .first()
        .click();
      await page
        .getByRole("button", { name: /^Confirm pick(?: & lineup)?:/ })
        .click();
    }
    const initial = await save();
    expect(initial.picks).toHaveLength(32);
    if (mode === "generational")
      expect(
        initial.picks.every((p: { pokemonId: number }) => p.pokemonId <= 151),
      ).toBe(true);
    else
      expect(
        initial.picks.some((p: { pokemonId: number }) => p.pokemonId > 905),
      ).toBe(true);
    await page
      .getByRole("button", { name: "Simulate local season", exact: true })
      .click();
    await expect(
      page.getByRole("table", { name: "Friends leaderboard" }),
    ).toBeVisible();
    await expect(
      page.getByText("4 teams. 2 rounds. Every series best of 1."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Finish playoffs", exact: true })
      .click();
    await expect(
      page.getByRole("article", { name: "Playoff champion", exact: true }),
    ).toBeVisible();
    const champion = await page
      .getByRole("article", { name: "Playoff champion", exact: true })
      .textContent();
    await page
      .getByRole("button", { name: /^View playoff box score:/ })
      .first()
      .click();
    await expect(
      page.getByRole("region", { name: "Game insights", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Shot result", exact: true })
      .selectOption("makes");
    await expect(
      page.getByRole("img", { name: /Shot chart for/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Season insights", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Build season insights", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Player game trends", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/career-${mode}-${info.project.name}-insights.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Begin offseason", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Local offseason", exact: true }),
    ).toBeVisible();
    if (mode === "generational") {
      await expect(
        page.getByRole("region", { name: "Rookie draft", exact: true }),
      ).toBeVisible();
      const before = await save();
      await page.reload();
      await expect(
        page.getByRole("region", { name: "Rookie draft", exact: true }),
      ).toBeVisible();
      expect((await save()).career).toEqual(before.career);
      for (let i = 0; i < 4; i++)
        await page
          .getByRole("button", { name: /^Draft .* and release / })
          .click();
      expect((await save()).career.history[0].rookiePicks).toHaveLength(8);
    } else {
      await expect(
        page.getByRole("region", { name: "Rookie draft", exact: true }),
      ).toHaveCount(0);
      expect((await save()).career.history[0].rookiePicks).toHaveLength(0);
    }
    // Human-to-human consent must be deliberate for the current proposal.
    await page.getByText("Offseason player trades", { exact: true }).click();
    await page
      .getByRole("combobox", { name: "Trade partner", exact: true })
      .selectOption("1");
    await expect(
      page.getByRole("button", { name: "Complete player trade", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Friend 1 agrees to this trade", { exact: true })
      .check();
    await page
      .getByLabel("Friend 2 agrees to this trade", { exact: true })
      .check();
    await page
      .getByRole("button", { name: "Complete player trade", exact: true })
      .click();
    expect((await save()).career.history[0].trades).toHaveLength(1);
    await page
      .getByRole("button", { name: "Start year 2", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Local league · Year 2", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Simulate local season", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Simulate local season", exact: true })
      .click();
    await expect(
      page.getByRole("table", { name: "Friends leaderboard" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Finish playoffs", exact: true })
      .click();
    await expect(
      page.getByRole("article", { name: "Playoff champion", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Open year 1", exact: true })
      .click();
    const history = page.getByRole("region", {
      name: "Career history",
      exact: true,
    });
    await expect(
      history.getByRole("article", { name: "Playoff champion", exact: true }),
    ).toHaveText(champion!);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/career-${mode}-${info.project.name}-history.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
