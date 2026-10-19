import { expect, test } from "@playwright/test";
import { asReturningPlayer } from "./returningPlayer";
test.beforeEach(({ page }) => asReturningPlayer(page));
test("automatic moves, specializations and actual game usage remain readable", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const evidence = await page.evaluate(async () => {
    const reactPath = "/node_modules/.vite/deps/react.js",
      domPath = "/node_modules/.vite/deps/react-dom_client.js",
      panelPath = "/src/components/MovesetPanel.tsx",
      fixturePath = "/src/game/seasonPerformance.testUtils.ts",
      leaguePath = "/src/game/league.ts",
      matchPath = "/src/game/match.ts";
    const [
      {
        default: { createElement },
      },
      {
        default: { createRoot },
      },
      panels,
      { performanceRun },
      { createLeague },
      { simulateMatch },
    ] = await Promise.all([
      import(reactPath),
      import(domPath),
      import(panelPath),
      import(fixturePath),
      import(leaguePath),
      import(matchPath),
    ]);
    const teams = createLeague({ ...performanceRun(), movesetVersion: 1 }).map(
      (t: any) => ({
        ...t,
        abilityMastery: Object.fromEntries(
          Object.values(t.roster).map((id) => [id, 400]),
        ),
      }),
    );
    const match = simulateMatch(teams[0], teams[1], 81);
    const boxes = [...match.homeBox, ...match.awayBox];
    const events = match.insights.court.flatMap((s: any) => s.moves ?? []);
    const uses = boxes.reduce(
      (sum: number, b: any) =>
        sum +
        Object.values(b.abilityActivations.moves.uses).reduce(
          (n: number, v: any) => n + v,
          0,
        ),
      0,
    );
    document.getElementById("root")!.style.display = "none";
    const target = document.createElement("main");
    target.style.cssText = "max-width:1100px;margin:auto;padding:16px";
    document.body.append(target);
    createRoot(target).render(
      createElement(
        "div",
        null,
        createElement(panels.MovesetPanel, {
          team: teams[0],
          pokemonId: teams[0].roster.PG,
        }),
        createElement(panels.GameMovesReport, {
          assignments: match.moveAssignments,
        }),
        createElement(panels.MoveUsage, {
          rows: boxes.map((b: any) => ({
            key: b.playerId,
            label: b.playerId,
            abilityActivations: b.abilityActivations,
          })),
        }),
      ),
    );
    return { uses, events: events.length };
  });
  expect(evidence.uses).toBeGreaterThan(20);
  expect(evidence.events).toBe(evidence.uses);
  const panel = page.getByRole("region", { name: "Basketball movesets" });
  await expect(panel).toContainText("four move slots unlocked");
  await expect(panel).toContainText("automatically");
  await expect(panel.getByText(/second cooldown/).first()).toBeVisible();
  await page
    .getByText("View equipped moves and specializations", { exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Game move assignments" }),
  ).toContainText("pregame");
  await expect(
    page.getByRole("region", { name: "Basketball move usage" }),
  ).toContainText("energy spent");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-basketball-moves.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
