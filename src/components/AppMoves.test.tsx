import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import App from "../App";
import { initialState } from "../game/state";
import { performanceRun } from "../game/seasonPerformance.testUtils";
import "../test/preloadPanels";

it("shows automatic move assignments in the real solo draft before a league exists", () => {
  const state = {
    ...initialState(822),
    run: { ...performanceRun(), movesetVersion: 1 as const },
  };
  render(
    <App
      initial={state}
      storage={{ getItem: () => null, setItem: () => {} }}
    />,
  );
  const panel = screen.getByRole("region", { name: "Basketball movesets" });
  expect(panel).toHaveTextContent(/automatically/);
  expect(panel).toHaveTextContent(/2 equipped moves/);
  expect(panel).not.toHaveTextContent(/moves are disabled/);
});
