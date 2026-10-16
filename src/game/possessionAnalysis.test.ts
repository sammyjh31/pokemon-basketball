import { expect, it } from "vitest";
import { buildSeasonInsights } from "./insightAnalysis";
import { insightLeague, insightMatch } from "./insightAnalysis.testUtils";
import { emptyPossessionPlayer, emptyPossessionTeam } from "./possessionTypes";
it("season totals include only recorded samples and exclude unavailable and manually played detail", async () => {
  const league = insightLeague(3);
  const data = await buildSeasonInsights(league, {
    resolveMatch: (g) => {
      const m = insightMatch();
      if (g.round === 1) delete m.insights;
      else if (g.round === 2) m.homeScore = 999;
      else
        m.insights!.possession = {
          version: 1,
          teams: [{ ...emptyPossessionTeam(0), points: 10, possessions: 9 }],
          players: [
            {
              ...emptyPossessionPlayer(0, "0:1"),
              potentialAssists: 5,
              assistPoints: 6,
            },
          ],
        };
      return m;
    },
  });
  expect(data.possession?.teams).toHaveLength(1);
  expect(data.possession?.teams[0]).toMatchObject({
    games: 1,
    points: 10,
    possessions: 9,
  });
  expect(data.possession?.players[0]).toMatchObject({
    games: 1,
    potentialAssists: 5,
    assistPoints: 6,
  });
  expect(data.missingTelemetryGames).toBe(1);
  expect(data.unavailableGames).toBe(1);
});
