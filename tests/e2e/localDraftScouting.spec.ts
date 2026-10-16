import { expect, test } from "@playwright/test";
import { asReturningPlayer } from "./returningPlayer";
test.beforeEach(({ page }) => asReturningPlayer(page));
// Advanced scouting is remembered per browser; these flows start with it open,
// except the first test, which opens it like a new scout would.
test.beforeEach(({ page }, info) =>
  info.title.startsWith("scout, compare")
    ? undefined
    : page.addInitScript(() =>
        localStorage.setItem("pokemon-basketball:advanced-scouting", "open"),
      ),
);

test("scout, compare across filters, and confirm a local pick", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#local-league");
  await page.getByLabel("Franchise progression").selectOption("full-pool");
  await page.getByLabel("League size").selectOption("4");
  await page.getByRole("button", { name: "Start snake draft" }).click();
  await page
    .getByRole("button", { name: "Draft Ash Ketchum", exact: true })
    .click();
  await page.getByRole("button", { name: "Draft Misty", exact: true }).click();
  const save = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("pokemon-basketball:local-league:v1")!),
    );
  const before = await save();
  const advanced = page.getByRole("group").filter({
    has: page.getByText("Advanced scouting", { exact: true }),
  });
  await expect(
    page.getByRole("region", { name: "Team impact ranking", exact: true }),
  ).toBeHidden();
  await page.getByText("Advanced scouting", { exact: true }).click();
  await expect(advanced).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Fit", exact: true }).focus();
  await expect(page.getByRole("tooltip").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("combobox", { name: "Rank players by" }),
  ).toHaveValue("impact");
  await expect(
    page.getByRole("combobox", { name: "Rank for position" }),
  ).toHaveValue("best-lineup");
  const rankedCards = page.getByRole("article", { name: /draft prospect$/ });
  await expect(rankedCards).toHaveCount(24);
  await expect(rankedCards.first()).toContainText("Rank 1");
  await expect(rankedCards.first()).toContainText("First pick");
  await page.getByRole("button", { name: "Show more Pokémon" }).click();
  await expect(rankedCards).toHaveCount(48);
  const ranks = await rankedCards
    .locator(".draft-impact-rank")
    .allTextContents();
  const rankNumbers = ranks.map((text) =>
    Number(text.match(/^Rank (\d+)/)![1]),
  );
  expect(rankNumbers).toEqual([...rankNumbers].sort((a, b) => a - b));
  expect(Number(ranks[0].match(/of (\d+)/)![1])).toBeGreaterThan(900);
  const names = (
    await page.getByRole("button", { name: /^View scouting for / }).all()
  ).slice(0, 3);
  const chosen: string[] = [];
  const positions = new Map<string, string>();
  const projections = new Map<string, string>();
  for (const button of names)
    chosen.push(
      (await button.getAttribute("aria-label"))!.replace(
        /^View scouting for /,
        "",
      ),
    );
  for (const name of chosen) {
    await page.getByRole("searchbox").fill(name);
    const card = page.getByRole("article", {
      name: `${name} draft prospect`,
      exact: true,
    });
    positions.set(
      name,
      (await card.getByText(/^Best lineup found:/).textContent())!.split(
        ": ",
      )[1],
    );
    projections.set(
      name,
      (await card.locator(".draft-impact-projected").textContent())!.split(
        " ",
      )[0],
    );
    await page
      .getByRole("button", { name: `Compare ${name}`, exact: true })
      .click();
  }
  await page.getByRole("searchbox").fill("no matching pokemon");
  await expect(
    page.getByText("No available Pokémon match that search."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Compare shortlist", exact: true })
    .click();
  const firstPickTable = page.getByRole("table", {
    name: "Team impact by candidate",
  });
  await expect(
    page.getByRole("combobox", { name: "Preview draft position" }),
  ).toHaveValue("best-lineup");
  for (const [index, name] of chosen.entries()) {
    await expect(
      firstPickTable.getByRole("columnheader", { name: new RegExp(name) }),
    ).toContainText(`With ${name} at ${positions.get(name)}`);
    await expect(
      firstPickTable
        .getByRole("row", { name: /^Balanced offense/ })
        .getByRole("cell")
        .nth(index + 1),
    ).toContainText(projections.get(name)!);
  }
  await page
    .getByRole("region", { name: "Compare team impact", exact: true })
    .screenshot({
      path: `test-results/draft-best-lineup-comparison-${info.project.name}.png`,
    });
  await expect(firstPickTable).toContainText("First pick");
  await expect(firstPickTable).not.toContainText("vs now");
  await page
    .getByText("Compare individual skills & physical profiles", { exact: true })
    .click();
  const table = page.getByRole("table", { name: "Pokémon draft comparison" });
  for (const name of chosen)
    await expect(
      table.getByRole("columnheader", { name: new RegExp(name) }),
    ).toBeVisible();
  await page
    .getByRole("combobox", {
      name: "Compare at the same position",
      exact: true,
    })
    .selectOption("C");
  await expect(table.getByRole("rowheader", { name: /^C fit/ })).toBeVisible();
  const comparisonScroll = page.getByRole("region", {
    name: "Scrollable player comparison",
    exact: true,
  });
  await table.locator("thead").scrollIntoViewIfNeeded();
  await comparisonScroll.evaluate((node) => {
    node.scrollLeft = node.scrollWidth;
  });
  await expect(
    table.getByRole("columnheader", { name: new RegExp(chosen[2]) }),
  ).toBeInViewport();
  await comparisonScroll.evaluate((node) => {
    node.scrollLeft = 0;
  });
  expect((await save()).picks).toEqual(before.picks);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("region", { name: "Comparison shortlist", exact: true })
    .screenshot({
      path: `test-results/draft-compare-${info.project.name}.png`,
    });
  await page
    .getByRole("button", { name: `Review ${chosen[0]} pick`, exact: true })
    .click();
  const inspector = page.getByRole("region", {
    name: "Selected prospect",
    exact: true,
  });
  await expect(
    inspector.getByRole("heading", { name: chosen[0], exact: true }),
  ).toBeFocused();
  await inspector.screenshot({
    path: `test-results/draft-scout-${info.project.name}.png`,
  });
  await expect(
    page.getByRole("combobox", { name: "Draft position", exact: true }),
  ).toHaveValue("best-lineup");
  await page
    .getByRole("button", {
      name: `Confirm pick & lineup: ${chosen[0]}`,
      exact: true,
    })
    .click();
  const after = await save();
  expect(after.picks.length).toBeGreaterThan(before.picks.length);
  expect(after.picks[before.picks.length].slot).toBe(positions.get(chosen[0]));
  await expect(
    page.getByRole("heading", { name: /On the clock/ }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Compare shortlist", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Rank for position" }),
  ).toHaveValue("best-lineup");
  await page.reload();
  expect((await save()).picks).toEqual(after.picks);
  await page
    .getByRole("heading", { name: "Find your next difference maker" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/draft-board-${info.project.name}.png`,
  });
  expect(errors).toEqual([]);
});

test("compare team impacts and review a pick without changing the saved draft", async ({
  page,
}, info) => {
  await page.goto("/#local-league");
  await page.evaluate(async () => {
    const leaguePath = "/src/game/localLeague.ts";
    const formatPath = "/src/game/localFormat.ts";
    const { createLocalLeague, pickLocalPlayer, LOCAL_LEAGUE_KEY } =
      await import(leaguePath);
    const { LOCAL_DEFAULT_OPTIONS } = await import(formatPath);
    const managers = Array.from({ length: 8 }, (_, teamId) => ({
      name: teamId === 0 ? "Sam" : `Friend ${teamId}`,
      teamId,
    }));
    let draft = createLocalLeague(
      managers,
      false,
      42,
      2,
      LOCAL_DEFAULT_OPTIONS,
    );
    draft.managers = draft.managers.map(
      (manager: { teamId: number; name: string }) => ({
        ...manager,
        name:
          manager.teamId === draft.order[0]
            ? "Sam"
            : `Friend ${manager.teamId}`,
      }),
    );
    const ids = [
      65, 143, 6, 68, 9, 3, 130, 149, 59, 76, 91, 94, 95, 103, 131, 135,
    ];
    for (let i = 0; i < ids.length; i++)
      draft = pickLocalPlayer(draft, ids[i], i < 8 ? "PG" : "SG");
    localStorage.setItem(LOCAL_LEAGUE_KEY, JSON.stringify(draft));
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "On the clock: Sam" }),
  ).toBeVisible();
  const save = () =>
    page.evaluate(() =>
      localStorage.getItem("pokemon-basketball:local-league:v1"),
    );
  const before = await save();
  const ranking = page.getByRole("region", {
    name: "Team impact ranking",
    exact: true,
  });
  await ranking
    .getByRole("combobox", { name: "Rank for position" })
    .selectOption("B1");
  await ranking
    .getByRole("combobox", { name: "Ranking priority" })
    .selectOption("rebounding");
  const rhydon = page.getByRole("article", {
    name: "Rhydon draft prospect",
    exact: true,
  });
  await expect(rhydon).toContainText("+6.0");
  const globalRank = await rhydon.locator(".draft-impact-rank").textContent();
  await ranking.screenshot({
    path: `test-results/draft-impact-ranking-controls-${info.project.name}.png`,
  });
  await rhydon.screenshot({
    path: `test-results/draft-impact-ranked-card-${info.project.name}.png`,
  });
  for (const name of ["Rhydon", "Pikachu", "Starmie"]) {
    await page.getByRole("searchbox").fill(name);
    if (name === "Rhydon")
      await expect(rhydon.locator(".draft-impact-rank")).toHaveText(
        globalRank!,
      );
    await page
      .getByRole("button", { name: `Compare ${name}`, exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Compare shortlist", exact: true })
    .click();
  const comparison = page.getByRole("region", {
    name: "Compare team impact",
    exact: true,
  });
  const table = comparison.getByRole("table", {
    name: "Team impact by candidate",
  });
  await expect(
    comparison.getByRole("combobox", { name: "Preview draft position" }),
  ).toHaveValue("B1");
  await expect(
    comparison.getByRole("combobox", { name: "Prioritize" }),
  ).toHaveValue("rebounding");
  await expect(comparison).toContainText("2 drafted players");
  await comparison
    .getByRole("combobox", { name: "Preview draft position" })
    .selectOption("C");
  const beforeOffense = await table
    .getByRole("row", { name: /Overall offense/ })
    .textContent();
  await comparison
    .getByRole("combobox", { name: "Preview draft position" })
    .selectOption("B1");
  await expect(
    table.getByRole("row", { name: /Overall offense/ }),
  ).not.toHaveText(beforeOffense!);
  await comparison
    .getByRole("combobox", { name: "Prioritize" })
    .selectOption("rebounding");
  await expect(comparison.getByRole("status")).toContainText("Rhydon");
  const reboundLeader = await comparison.getByRole("status").textContent();
  await comparison
    .getByRole("combobox", { name: "Prioritize" })
    .selectOption("spacing");
  await expect(comparison.getByRole("status")).not.toHaveText(reboundLeader!);
  await expect(comparison.getByRole("status")).toContainText("Starmie");
  await expect(comparison.getByRole("status")).toContainText(
    "this team average does not rise",
  );
  await comparison
    .getByRole("combobox", { name: "Prioritize" })
    .selectOption("rebounding");
  const comparisonScroll = comparison.getByRole("region", {
    name: "Scrollable team impact comparison",
    exact: true,
  });
  await comparisonScroll.evaluate((node) => {
    node.scrollLeft = node.scrollWidth;
  });
  await expect(
    table.getByRole("columnheader", { name: /Starmie/ }),
  ).toBeInViewport();
  await comparisonScroll.evaluate((node) => {
    node.scrollLeft = 0;
  });
  expect(await save()).toBe(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await comparison.screenshot({
    path: `test-results/draft-impact-comparison-${info.project.name}.png`,
  });
  await comparison.getByRole("button", { name: "Review Rhydon pick" }).click();
  await expect(
    page.getByRole("combobox", { name: "Draft position", exact: true }),
  ).toHaveValue("B1");
  const impact = page.getByRole("region", {
    name: "Team impact preview",
    exact: true,
  });
  await expect(impact).toContainText("2 → 3 players");
  await expect(
    impact.getByRole("row", { name: /Shooting \/ spacing/ }),
  ).toContainText("−");
  await expect(impact.getByRole("row", { name: /Rebounding/ })).toContainText(
    "+",
  );
  const benchOffense = await impact
    .getByRole("row", { name: /Overall offense/ })
    .textContent();
  await page
    .getByRole("combobox", { name: "Draft position", exact: true })
    .selectOption("C");
  await expect(impact).toContainText("Rhydon at C");
  await expect(
    impact.getByRole("row", { name: /Overall offense/ }),
  ).not.toHaveText(benchOffense!);
  expect(await save()).toBe(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await impact.screenshot({
    path: `test-results/draft-team-impact-${info.project.name}.png`,
  });
  await page.reload();
  expect(await save()).toBe(before);
  await expect(
    page.getByRole("heading", { name: "On the clock: Sam" }),
  ).toBeVisible();
});

test("reviews lineup moves and saves exactly the proposed positions", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#local-league");
  await page.evaluate(async () => {
    const leaguePath = "/src/game/localLeague.ts",
      formatPath = "/src/game/localFormat.ts";
    const { createLocalLeague, pickLocalPlayer, LOCAL_LEAGUE_KEY } =
      await import(leaguePath);
    const { LOCAL_DEFAULT_OPTIONS } = await import(formatPath);
    let draft = createLocalLeague(
      Array.from({ length: 8 }, (_, teamId) => ({
        name: `Friend ${teamId}`,
        teamId,
      })),
      false,
      42,
      2,
      { ...LOCAL_DEFAULT_OPTIONS, mode: "full-pool" },
    );
    // Last manager in round one picks again first in round two; Onix is at PG.
    for (const id of [1, 2, 3, 4, 5, 6, 7, 95])
      draft = pickLocalPlayer(draft, id, "PG");
    localStorage.setItem(LOCAL_LEAGUE_KEY, JSON.stringify(draft));
  });
  await page.reload();
  const readSave = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("pokemon-basketball:local-league:v1")!),
    );
  const before = await readSave();
  await page.getByRole("searchbox").fill("Alakazam");
  const card = page.getByRole("article", {
    name: "Alakazam draft prospect",
    exact: true,
  });
  await expect(card).toContainText("Best lineup found: PG", { timeout: 15000 });
  const score = (await card
    .locator(".draft-impact-projected")
    .textContent())!.split(" ")[0];
  await page
    .getByRole("button", { name: "Compare Alakazam", exact: true })
    .click();
  await page.getByRole("searchbox").fill("Rhydon");
  await page
    .getByRole("button", { name: "Compare Rhydon", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare shortlist", exact: true })
    .click();
  const comparison = page.getByRole("region", {
    name: "Compare team impact",
    exact: true,
  });
  const table = comparison.getByRole("table");
  await expect(
    table
      .getByRole("row", { name: /^Balanced offense/ })
      .getByRole("cell")
      .nth(1),
  ).toContainText(score);
  await expect(
    table.getByRole("row", { name: /^Lineup & moves/ }),
  ).toContainText("PG →");
  await comparison.screenshot({
    path: `test-results/draft-lineup-moves-comparison-${info.project.name}.png`,
  });
  await page
    .getByRole("button", { name: "Review Alakazam pick", exact: true })
    .click();
  const proposal = page.getByRole("region", {
    name: "Suggested lineup changes",
    exact: true,
  });
  await expect(proposal).toContainText("Onix");
  const moves = await proposal
    .getByRole("list", { name: "Proposed lineup" })
    .getByRole("listitem")
    .allTextContents();
  const onixSlot = moves
    .find((text) => text.includes("Onix"))!
    .match(/^(PG|SG|SF|PF|C|B1|B2|B3)/)![1];
  expect(onixSlot).not.toBe("PG");
  expect(await readSave()).toEqual(before);
  await proposal.screenshot({
    path: `test-results/draft-lineup-moves-preview-${info.project.name}.png`,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", {
      name: "Confirm pick & lineup: Alakazam",
      exact: true,
    })
    .click();
  const after = await readSave();
  const teamId = before.order[7];
  expect(
    after.picks.filter((p: { teamId: number }) => p.teamId === teamId),
  ).toEqual([
    { teamId, pokemonId: 95, slot: onixSlot },
    { teamId, pokemonId: 65, slot: "PG" },
  ]);
  expect(
    after.picks.filter((p: { teamId: number }) => p.teamId !== teamId),
  ).toEqual(
    before.picks.filter((p: { teamId: number }) => p.teamId !== teamId),
  );
  await page.reload();
  expect((await readSave()).picks).toEqual(after.picks);
  expect(errors).toEqual([]);
});

test("locks positions across ranking, comparison, confirmation and reload", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#local-league");
  await page.evaluate(async () => {
    const leaguePath = "/src/game/localLeague.ts",
      formatPath = "/src/game/localFormat.ts";
    const { createLocalLeague, pickLocalPlayer, LOCAL_LEAGUE_KEY } =
      await import(leaguePath);
    const { LOCAL_DEFAULT_OPTIONS } = await import(formatPath);
    let draft = createLocalLeague(
      Array.from({ length: 8 }, (_, teamId) => ({
        name: `Friend ${teamId}`,
        teamId,
      })),
      false,
      42,
      2,
      { ...LOCAL_DEFAULT_OPTIONS, mode: "full-pool" },
    );
    for (const id of [1, 2, 3, 4, 5, 6, 7, 95])
      draft = pickLocalPlayer(draft, id, "PG");
    localStorage.setItem(LOCAL_LEAGUE_KEY, JSON.stringify(draft));
  });
  await page.reload();
  const save = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("pokemon-basketball:local-league:v1")!),
    );
  const original = await save();
  await page.getByRole("searchbox").fill("Alakazam");
  const card = page.getByRole("article", {
    name: "Alakazam draft prospect",
    exact: true,
  });
  await expect(card).toContainText("Best lineup found: PG", { timeout: 15000 });
  await page
    .getByRole("button", { name: "View scouting for Alakazam", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lock Onix at PG", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Selected prospect", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Unlock Onix at PG", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card).not.toContainText("Best lineup found: PG");
  await page
    .getByRole("region", { name: "Position locks", exact: true })
    .screenshot({
      path: `test-results/draft-position-locks-${info.project.name}.png`,
    });
  const lockedSave = await save();
  expect(lockedSave.picks).toEqual(original.picks);
  expect(lockedSave.positionLocks).toEqual([
    { teamId: original.order[7], pokemonId: 95, slot: "PG" },
  ]);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unlock Onix at PG", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const name of ["Alakazam", "Rhydon"]) {
    await page.getByRole("searchbox").fill(name);
    await page
      .getByRole("button", { name: `Compare ${name}`, exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Compare shortlist", exact: true })
    .click();
  const comparison = page.getByRole("region", {
    name: "Compare team impact",
    exact: true,
  });
  await expect(
    comparison.getByText("Locked at PG", { exact: true }),
  ).toHaveCount(3);
  await comparison.screenshot({
    path: `test-results/draft-locked-comparison-${info.project.name}.png`,
  });
  await page
    .getByRole("button", { name: "Review Alakazam pick", exact: true })
    .click();
  const proposed = page.getByRole("region", {
    name: "Suggested lineup changes",
    exact: true,
  });
  await expect(
    proposed.getByRole("list", { name: "Proposed lineup" }),
  ).toContainText("Locked at PG");
  expect(await save()).toEqual(lockedSave);
  await page
    .getByRole("button", { name: "Unlock Onix at PG", exact: true })
    .click();
  await page.getByRole("searchbox").fill("Alakazam");
  await expect(card).toContainText("Best lineup found: PG", { timeout: 15000 });
  // Rapid updates must discard the older unlocked search.
  await page
    .getByRole("button", { name: "Lock Onix at PG", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Unlock Onix at PG", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lock Onix at PG", exact: true })
    .click();
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card).not.toContainText("Best lineup found: PG");
  await page
    .getByRole("button", { name: "View scouting for Alakazam", exact: true })
    .click();
  await expect(
    proposed.getByRole("list", { name: "Proposed lineup" }),
  ).toContainText("Locked at PG");
  await page
    .getByRole("button", {
      name: "Confirm pick & lineup: Alakazam",
      exact: true,
    })
    .click();
  const after = await save();
  expect(
    after.picks.find((p: { pokemonId: number }) => p.pokemonId === 95).slot,
  ).toBe("PG");
  expect(after.picks.at(-1).pokemonId).toBe(65);
  expect(after.picks.at(-1).slot).not.toBe("PG");
  expect(after.positionLocks).toEqual(lockedSave.positionLocks);
  await expect(
    page.getByRole("button", { name: "Unlock Onix at PG", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lock Squirtle at PG", exact: true }),
  ).toBeVisible();
  await page.reload();
  expect((await save()).positionLocks).toEqual(lockedSave.positionLocks);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
