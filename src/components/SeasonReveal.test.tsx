import { useLayoutEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SeasonPanel } from "./SeasonPanel";
import { createRun } from "../game/draft";
import { simulateSeason } from "../game/legacySeason";
import { teamRatings } from "../game/ratings";
import type { Run } from "../game/types";
import "../test/preloadPanels";

afterEach(() => vi.useRealTimers());

it("keeps an immediate skip when a completed result arrives before its reveal effect", async () => {
  vi.useFakeTimers();
  const run: Run = {
    ...createRun("free", true, 17),
    roster: {
      PG: 65,
      SG: 135,
      SF: 6,
      PF: 68,
      C: 143,
      B1: 121,
      B2: 149,
      B3: 131,
    },
  };
  const ratings = teamRatings(run.roster);
  function Arrival({ current }: { current: Run }) {
    // Exercise the earliest possible click after the result reaches the DOM.
    useLayoutEffect(() => {
      if (current.result)
        screen.getByRole("button", { name: "Skip reveal" }).click();
    }, [current.result]);
    return (
      <SeasonPanel
        run={current}
        ratings={ratings}
        animate
        onSimulate={() => {}}
      />
    );
  }
  const view = render(<Arrival current={run} />);
  await act(async () => {
    view.rerender(
      <Arrival
        current={{
          ...run,
          result: { ...simulateSeason(run), modelVersion: 1 },
        }}
      />,
    );
  });
  expect(screen.getAllByTestId("game-result")).toHaveLength(82);
  await act(async () => vi.advanceTimersByTime(100));
  expect(screen.getAllByTestId("game-result")).toHaveLength(82);
});
