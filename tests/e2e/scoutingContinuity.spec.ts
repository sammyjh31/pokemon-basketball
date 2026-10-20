import { expect, test } from "@playwright/test";
import { asReturningPlayer } from "./returningPlayer";
test.beforeEach(({ page }) => asReturningPlayer(page));
test("coaches explain knowledge across a season, trade and coaching change", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const proof = await page.evaluate(async () => {
    const paths = [
      "/node_modules/.vite/deps/react.js",
      "/node_modules/.vite/deps/react-dom_client.js",
      "/src/components/CoachScoutingSummary.tsx",
      "/src/components/GameCounterReport.tsx",
      "/src/game/seasonPerformance.testUtils.ts",
      "/src/game/league.ts",
      "/src/game/match.ts",
      "/src/game/opponentScouting.ts",
      "/src/game/scoutingContinuity.ts",
      "/src/game/rosterTrades.ts",
    ];
    const [
      react,
      dom,
      summary,
      report,
      fixture,
      league,
      engine,
      scout,
      continuity,
      trades,
    ] = await Promise.all(paths.map((p) => import(p)));
    const teams = league.createLeague({
      ...fixture.performanceRun(),
      movesetVersion: 3,
    });
    const game = engine.simulateMatch(teams[0], teams[1], 831, {
      collectInsights: false,
    });
    const memory: any = {};
    scout.recordScouting(memory, teams[0], teams[1], game);
    const book = {
      version: 1,
      year: 1,
      teams: teams.map((t: any) => ({
        id: t.id,
        roster: Object.values(t.roster),
        coachId: t.coach.id,
      })),
      coaches: {
        [teams[0].coach.id]: { teamId: 0, opponents: { 1: memory["0:1"] } },
      },
    };
    const changed = structuredClone(
      trades.exchangePlayers(
        teams,
        1,
        2,
        teams[1].roster.PG,
        teams[2].roster.PG,
      ),
    );
    [changed[1].coach, changed[2].coach] = [changed[2].coach, changed[1].coach];
    const next = continuity.seedCoachScouting(
      [{ year: 1, coachBook: book }],
      changed,
      2,
    );
    const second = engine.simulateMatch(next[0], next[1], 832);
    document.getElementById("root")!.style.display = "none";
    const target = document.createElement("main");
    target.style.cssText = "max-width:1100px;margin:auto;padding:16px";
    document.body.append(target);
    dom.default.createRoot(target).render(
      react.default.createElement(
        "div",
        null,
        react.default.createElement(summary.CoachScoutingSummary, {
          team: next[0],
        }),
        react.default.createElement(report.GameCounterReport, {
          plans: second.counterPlans,
          teams: next.slice(0, 2),
          sequences: second.insights.court,
        }),
      ),
    );
    return {
      known: Object.keys(next[0].scoutingSeed.opponents[2].scouting.players)
        .length,
      changed: next[0].scoutingSeed.opponents[1].coachChanged,
    };
  });
  expect(proof.known).toBeGreaterThan(0);
  expect(proof.changed).toBe(true);
  const summary = page.getByRole("region", {
    name: "Scouting carried into this season",
  });
  await expect(summary).toContainText("2 opponents");
  await summary
    .getByText("View opponent knowledge and offseason changes", { exact: true })
    .click();
  await expect(summary).toContainText("7/8");
  await expect(summary).toContainText("New opposing coach");
  await expect(summary).toContainText("Recognized player tendencies");
  await expect(
    page.getByRole("region", { name: "Coach counter scouting" }),
  ).toContainText("New opposing coach");
  await expect(summary.getByRole("combobox")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-scouting-continuity.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
