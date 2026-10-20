import { expect, test } from "@playwright/test";
import { asReturningPlayer } from "./returningPlayer";
test.beforeEach(({ page }) => asReturningPlayer(page));
test("coaches explain outcome learning and actual with/without attack results automatically", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const evidence = await page.evaluate(async () => {
    const paths = [
      "/node_modules/.vite/deps/react.js",
      "/node_modules/.vite/deps/react-dom_client.js",
      "/src/components/GameCounterReport.tsx",
      "/src/components/MovesetPanel.tsx",
      "/src/game/seasonPerformance.testUtils.ts",
      "/src/game/league.ts",
      "/src/game/match.ts",
      "/src/game/opponentScouting.ts",
    ];
    const [react, dom, report, panels, fixture, league, engine, scout] =
      await Promise.all(paths.map((path) => import(path)));
    const teams = league
      .createLeague({ ...fixture.performanceRun(), movesetVersion: 4 })
      .map((team: any) => ({
        ...team,
        abilityMastery: Object.fromEntries(
          Object.values(team.roster).map((id) => [id, 400]),
        ),
      }));
    const memory = {};
    const first = engine.simulateMatch(teams[0], teams[1], 1982, {
      collectInsights: false,
    });
    scout.recordScouting(memory, teams[0], teams[1], first);
    const second = engine.simulateMatch(teams[0], teams[1], 1983, {
      scouting: scout.scoutingForMatch(memory, 0, 1),
    });
    const boxes = [...second.homeBox, ...second.awayBox];
    const events = second.insights.court.flatMap((s: any) => s.counters ?? []);
    document.getElementById("root")!.style.display = "none";
    const target = document.createElement("main");
    target.style.cssText = "max-width:1100px;margin:auto;padding:16px";
    document.body.append(target);
    dom.default.createRoot(target).render(
      react.default.createElement(
        "div",
        null,
        react.default.createElement(report.GameCounterReport, {
          plans: second.counterPlans,
          results: second.counterResults,
          teams: teams.slice(0, 2),
          sequences: second.insights.court,
        }),
        react.default.createElement(panels.MoveUsage, {
          rows: boxes.map((b: any) => ({
            key: b.playerId,
            label: b.playerId,
            abilityActivations: b.abilityActivations,
          })),
        }),
      ),
    );
    return {
      events: events.length,
      priorReads: second.counterPlans.home.length,
      learned: second.counterPlans.home.some(
        (p: any) => p.learning?.attacks > 0,
      ),
    };
  });
  expect(evidence.events).toBeGreaterThan(0);
  expect(evidence.priorReads).toBeGreaterThan(0);
  expect(evidence.learned).toBe(true);
  const report = page.getByRole("region", { name: "Coach counter scouting" });
  await expect(report).toContainText("confidence");
  await expect(report).toContainText("pregame reads");
  await expect(report.getByRole("combobox")).toHaveCount(0);
  await report
    .getByText("Counter results in this game", { exact: true })
    .click();
  await report
    .locator("summary")
    .filter({ hasText: "counter outcomes" })
    .first()
    .click();
  await expect(report).toContainText("not proof");
  await expect(report.getByRole("table").first()).toBeVisible();
  await report.screenshot({
    path: `test-results/${info.project.name}-counter-learning-report.png`,
  });
  await report
    .getByText("View counter timing and participants", { exact: true })
    .click();
  await expect(report).toContainText("elapsed");
  await expect(
    page.getByRole("region", { name: "Basketball move usage" }),
  ).toContainText("Participant activations");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-counter-learning.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
