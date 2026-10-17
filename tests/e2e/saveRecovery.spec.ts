import { statSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const KEY = "pokemon-basketball:v3";
const LOCAL_KEY = "pokemon-basketball:local-league:v1";

/** Builds saves with the game's own modules, served by the dev server. */
async function fixtures(page: Page) {
  await page.goto("/");
  return page.evaluate(async () => {
    const statePath = "/src/game/state.ts";
    const leaguePath = "/src/game/localLeague.ts";
    const { initialState, gameReducer } = await import(statePath);
    const { createLocalLeague } = await import(leaguePath);
    const start = initialState(7);
    const draft = gameReducer(start, {
      type: "PLACE",
      position: "PG",
      pokemonId: start.run.offerIds[0],
    });
    // A partly drafted challenge written by the first save format.
    const original = initialState(12);
    original.run.offerIds = [25, 65, 68, 143];
    const legacy = {
      ...original,
      version: 1,
      run: {
        ...original.run,
        roster: { PG: null, SG: null, SF: null, PF: null, C: null },
      },
    };
    const league = createLocalLeague(
      [
        { name: "Sam", teamId: 0 },
        { name: "Alex", teamId: 1 },
      ],
      false,
      42,
      2,
    );
    return {
      draft: JSON.stringify(draft),
      legacy: JSON.stringify(legacy),
      league: JSON.stringify(league),
    };
  });
}

/** Seeds storage once per tab, before the app reads it, then reloads. */
async function seed(
  page: Page,
  entries: Record<string, string>,
  oversized?: { key: string; length: number },
  path = "/",
) {
  await page.addInitScript(
    ({ entries, oversized }) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.clear();
      for (const [key, value] of Object.entries(entries))
        localStorage.setItem(key, value);
      if (oversized)
        localStorage.setItem(
          oversized.key,
          `{"version":3,"run":"${"x".repeat(oversized.length)}"}`,
        );
    },
    { entries, oversized },
  );
  await page.goto(path);
  await page.reload();
}
const stored = (page: Page, key: string) =>
  page.evaluate((key) => localStorage.getItem(key), key);
/** Reads a save the way the app does, following IndexedDB pointers. */
const saved = (page: Page, key: string) =>
  page.evaluate((key) => {
    const local = localStorage.getItem(key);
    if (!local?.startsWith("@indexeddb:")) return Promise.resolve(local);
    return new Promise<string | null>((resolve, reject) => {
      const open = indexedDB.open("pokemon-basketball-saves");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const read = open.result
          .transaction("saves")
          .objectStore("saves")
          .get(key);
        read.onsuccess = () => resolve(read.result ?? null);
        read.onerror = () => reject(read.error);
      };
    });
  }, key);
/** New runs start by drafting a trainer coach. */
async function chooseCoachIfOffered(page: Page) {
  const coaches = page.getByRole("region", {
    name: "Your team. Their game plan.",
  });
  if (await coaches.isVisible())
    await coaches
      .getByRole("button", { name: /^Draft / })
      .first()
      .click();
}
async function draftOne(page: Page, slot: string) {
  await chooseCoachIfOffered(page);
  await page
    .getByRole("button", { name: /^Draft / })
    .first()
    .click();
  await page
    .getByRole("button", { name: `${slot} slot: Empty`, exact: true })
    .click();
}

test("sets a corrupt save aside and restores the last verified backup", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { draft } = await fixtures(page);
  await seed(page, {
    [KEY]: '{"version":3,"run":',
    [`${KEY}:backup`]: draft,
  });
  await expect(page.getByText(/set aside in Save options/)).toBeVisible();
  expect(await stored(page, `${KEY}:quarantine`)).toBe('{"version":3,"run":');
  await page
    .getByRole("button", { name: "Restore last verified backup" })
    .click();
  await page.getByRole("button", { name: "Restore backup" }).click();
  await expect.poll(() => stored(page, KEY)).toBe(draft);
  await expect(
    page.getByText("Your saved game could not be restored", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "PG slot: Empty", exact: true }),
  ).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download set-aside save" }).click();
  expect((await download).suggestedFilename()).toMatch(/set-aside\.json$/);
  await page.getByRole("button", { name: "Discard it" }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download set-aside save" }),
  ).toHaveCount(0);
  expect(await stored(page, `${KEY}:quarantine`)).toBeNull();
  expect(errors).toEqual([]);
});

test("keeps an oversized save near the storage quota and continues saving", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page, {}, { key: KEY, length: 4_400_000 });
  await expect(page.getByText(/set aside in Save options/)).toBeVisible();
  // The copy does not fit beside the original in localStorage.
  await expect
    .poll(() => stored(page, `${KEY}:quarantine`))
    .toMatch(/^@indexeddb:/);
  await draftOne(page, "PG");
  await expect
    .poll(async () => (await stored(page, KEY))?.length ?? 0)
    .toBeLessThan(100_000);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "PG slot: Empty", exact: true }),
  ).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download set-aside save" }).click();
  const file = await (await download).path();
  expect(statSync(file).size).toBeGreaterThan(4_400_000);
  expect(errors).toEqual([]);
});

test("loads an old-version save and keeps it as the verified backup", async ({
  page,
}) => {
  const { legacy } = await fixtures(page);
  await seed(page, { "pokemon-basketball:v1": legacy });
  await expect(
    page.getByRole("region", { name: "Your team. Their game plan." }),
  ).toBeVisible();
  await expect(page.getByText(/could not be restored/)).toHaveCount(0);
  expect(await stored(page, `${KEY}:backup`)).toBe(legacy);
  // The saved offers survive once a trainer is drafted.
  await chooseCoachIfOffered(page);
  await expect(
    page.getByRole("button", { name: "Draft Pikachu", exact: true }),
  ).toBeVisible();
});

test("exports a save and imports it back after confirming", async ({
  page,
}, info) => {
  const { draft } = await fixtures(page);
  await seed(page, { [KEY]: draft });
  await page.getByText("Save options").click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export save" }).click();
  const exported = await (await download).path();
  await draftOne(page, "SG");
  await expect
    .poll(async () => JSON.parse((await stored(page, KEY))!).run.roster.SG)
    .not.toBeNull();
  await page.getByLabel("Import game save file").setInputFiles(exported);
  await expect(
    page.getByRole("dialog", { name: "Replace your current save?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replace save" }).click();
  // The exported save predates drafting a trainer, so the picker returns.
  await expect(
    page.getByRole("region", { name: "Your team. Their game plan." }),
  ).toBeVisible();
  await expect
    .poll(async () => JSON.parse((await stored(page, KEY))!).run.roster.SG)
    .toBeNull();
  // A file that is not a save changes nothing.
  const junk = info.outputPath("junk.json");
  writeFileSync(junk, '{"hello":1}');
  await page.getByLabel("Import game save file").setInputFiles(junk);
  await expect(
    page.getByText("This file is not a Pokémon Basketball save."),
  ).toBeVisible();
});

test("sets a damaged local league aside and imports a valid one", async ({
  page,
}, info) => {
  const { league } = await fixtures(page);
  await seed(page, { [LOCAL_KEY]: "{bad" }, undefined, "/#local-league");
  await expect(
    page.getByText(/A copy was set aside in Save options/),
  ).toBeVisible();
  expect(await stored(page, `${LOCAL_KEY}:quarantine`)).toBe("{bad");
  const file = info.outputPath("league.json");
  writeFileSync(file, league);
  await page.getByLabel("Import local league save file").setInputFiles(file);
  await page.getByRole("button", { name: "Replace save" }).click();
  await expect(
    page.getByRole("heading", { name: /On the clock/ }),
  ).toBeVisible();
  await expect.poll(() => stored(page, `${LOCAL_KEY}:backup`)).toBe(league);
  expect(await stored(page, `${LOCAL_KEY}:quarantine`)).toBe("{bad");
});

test("pauses saving in a tab after another tab changes the save", async ({
  context,
}) => {
  const first = await context.newPage();
  await first.goto("/");
  await expect(
    first.getByRole("button", { name: /^Draft / }).first(),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await draftOne(second, "PG");
  await expect(
    first.getByText(/changed in another tab\. Saving is paused here/),
  ).toBeVisible();
  const newer = await stored(second, KEY);
  await draftOne(first, "SG");
  expect(await stored(first, KEY)).toBe(newer);
  await first.getByRole("button", { name: "Reload to continue" }).click();
  await expect(first.getByText(/changed in another tab/)).toHaveCount(0);
  await expect(
    first.getByRole("button", { name: "PG slot: Empty", exact: true }),
  ).toHaveCount(0);
});

test("verifies a completed season in the restore worker", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/");
  const season = await page.evaluate(async () => {
    const statePath = "/src/game/state.ts";
    const typesPath = "/src/game/types.ts";
    const { initialState, gameReducer } = await import(statePath);
    const { ROSTER_SLOTS } = await import(typesPath);
    let state = initialState(31);
    for (const position of ROSTER_SLOTS)
      state = gameReducer(state, {
        type: "PLACE",
        position,
        pokemonId: state.run.offerIds[0],
      });
    return JSON.stringify(gameReducer(state, { type: "SIMULATE" }));
  });
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  await seed(page, { [KEY]: season });
  await expect(page.getByTestId("season-record")).toBeVisible({
    timeout: 120000,
  });
  expect(workers.some((url) => url.includes("restore.worker"))).toBe(true);
  await expect(page.getByText(/could not be restored/)).toHaveCount(0);
  // A full season is too large for localStorage beside the original.
  await expect
    .poll(() => stored(page, `${KEY}:backup`))
    .toMatch(/^@indexeddb:/);
  expect(await saved(page, `${KEY}:backup`)).toBe(season);
});
