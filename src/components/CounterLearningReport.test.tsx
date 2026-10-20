import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { GameCounterReport } from "./GameCounterReport";
import { signatureTeam } from "../game/signatureTestUtils";
import {
  emptyCounterResults,
  counterDecision,
  emptyCounterSample,
} from "../game/counterLearning";
it("shows learned emphasis and observed comparisons without promising stops", () => {
  const results = emptyCounterResults();
  results.counters["top-lock"] = {
    used: {
      ...emptyCounterSample(),
      attacks: 20,
      points: 10,
      scoreless: 15,
      energy: 50,
    },
    without: { ...emptyCounterSample(), attacks: 20, points: 35 },
  };
  const team = { ...signatureTeam(), id: 0, name: "Home", ratings: {} as any };
  render(
    <GameCounterReport
      plans={{
        home: [
          {
            id: "top-lock",
            observations: 30,
            confidence: 0.8,
            learning: counterDecision(results, "top-lock"),
          },
        ],
        away: [],
      }}
      teams={[team, { ...team, id: 1, name: "Away" }]}
      results={{ home: results }}
    />,
  );
  const report = screen.getByRole("region", { name: "Coach counter scouting" });
  expect(report).toHaveTextContent("Prioritize");
  expect(report).toHaveTextContent("0.50");
  expect(report).toHaveTextContent("1.75");
  expect(report).toHaveTextContent("not proof");
  expect(report).toHaveTextContent("Counter results in this game");
  expect(screen.queryByRole("combobox")).toBeNull();
});
