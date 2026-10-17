import { expect, test } from "@playwright/test";
/** Each test uses Playwright's isolated temporary browser context. */
test("franchise news and mastery stay readable on desktop and mobile", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(async () => {
    const reactPath = "/node_modules/.vite/deps/react.js",
      domPath = "/node_modules/.vite/deps/react-dom_client.js",
      panelPath = "/src/components/FranchisePanel.tsx",
      draftPath = "/src/game/draft.ts",
      leaguePath = "/src/game/league.ts";
    const [
      {
        default: { createElement },
      },
      {
        default: { createRoot },
      },
      { FranchisePanel },
      { createRun },
      { createLeague },
    ] = await Promise.all([
      import(/* @vite-ignore */ reactPath),
      import(/* @vite-ignore */ domPath),
      import(/* @vite-ignore */ panelPath),
      import(/* @vite-ignore */ draftPath),
      import(/* @vite-ignore */ leaguePath),
    ]);
    document.getElementById("root")!.style.display = "none";
    const target = document.createElement("main");
    target.id = "qa-root";
    target.style.cssText = "max-width:1200px;margin:auto;padding:16px";
    document.body.append(target);
    const run = {
      ...createRun("free", false, 11),
      roster: {
        PG: 65,
        SG: 135,
        SF: 149,
        PF: 68,
        C: 143,
        B1: 121,
        B2: 6,
        B3: 131,
      },
    };
    const teams = createLeague(run).map(
      (t: { id: number; roster: Record<string, number> }) => ({
        ...t,
        abilityMastery: Object.fromEntries(
          Object.values(t.roster).map((id) => [id, t.id === 0 ? 215 : 80]),
        ),
      }),
    );
    const mastery = [
      {
        teamId: 0,
        pokemonId: 65,
        before: 180,
        after: 215,
        gained: 35,
        levelBefore: "Practiced",
        levelAfter: "Skilled",
        focus: "playmaking",
        breakthrough: true,
        reasons: [
          "Coach assigned playmaking practice.",
          "Recorded coachability supported learning.",
        ],
      },
      {
        teamId: 1,
        pokemonId: teams[1].roster.PG,
        before: 60,
        after: 80,
        gained: 20,
        levelBefore: "Developing",
        levelAfter: "Practiced",
        focus: "balanced",
        breakthrough: false,
        reasons: ["Completed balanced camp."],
      },
    ];
    const franchise = {
      modelVersion: 3,
      year: 2,
      phase: "offseason",
      teams,
      careers: [],
      history: [],
      trades: [
        {
          year: 2,
          fromTeamId: 1,
          teamId: 2,
          giveId: teams[1].roster.PG,
          receiveId: teams[2].roster.PG,
        },
      ],
      offseasons: [
        {
          modelVersion: 1,
          year: 1,
          players: [],
          mastery: [
            {
              ...mastery[0],
              before: 40,
              after: 75,
              gained: 35,
              levelBefore: "Developing",
              levelAfter: "Practiced",
            },
          ],
          tradeStart: 0,
          tradeCount: 0,
        },
        {
          modelVersion: 1,
          year: 2,
          players: [],
          mastery,
          tradeStart: 0,
          tradeCount: 1,
        },
      ],
    };
    createRoot(target).render(
      createElement(FranchisePanel, {
        state: {
          version: 3,
          run,
          franchise,
          records: {
            spin: { runs: 0, bestWins: 0, perfectSeasons: 0 },
            free: { runs: 0, bestWins: 0, perfectSeasons: 0 },
          },
        },
        onEnterOffseason: () => {},
        onStartSeason: () => {},
        onTrade: () => {},
      }),
    );
  });
  await page.getByRole("button", { name: "League news", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "League news", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(3);
  await page.getByLabel("Your teams only").check();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByText("Alakazam reaches Skilled", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("News season").selectOption("1");
  await expect(
    page.getByText("Alakazam reaches Practiced", { exact: true }),
  ).toBeVisible();
  await page.getByText("Recorded details", { exact: true }).click();
  await expect(
    page.getByText("Coach assigned playmaking practice.", { exact: true }),
  ).toBeVisible();
  const contrast = await page
    .locator(".news-story")
    .first()
    .evaluate((card) => {
      const luminance = (color: string) => {
        const rgb = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((n) => {
            const s = n / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const background = luminance(getComputedStyle(card).backgroundColor);
      return [...card.querySelectorAll("h4,p,summary")].map((el) => {
        const foreground = luminance(getComputedStyle(el).color);
        return (
          (Math.max(background, foreground) + 0.05) /
          (Math.min(background, foreground) + 0.05)
        );
      });
    });
  expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: `test-results/${info.project.name}-mastery-news.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ability mastery", exact: true })
    .click();
  await expect(page.getByRole("progressbar")).toHaveCount(8);
  await expect(page.getByText("215.00 XP", { exact: true })).toHaveCount(8);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: `test-results/${info.project.name}-mastery-roster.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
