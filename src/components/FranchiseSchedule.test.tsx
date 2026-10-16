import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { officialFixture } from "../game/officialGame.testUtils";
import { replaySeasonProgress } from "../game/interactiveSeason";
import { FranchiseSchedule } from "./FranchiseSchedule";

it("shows completed-game records before ten games and exposes separate play/simulate actions", () => {
  const { run } = officialFixture();
  const result = replaySeasonProgress(run, 1, {});
  const onPlay = vi.fn(),
    onAdvance = vi.fn();
  render(
    <FranchiseSchedule
      run={{
        ...run,
        seasonProgress: {
          modelVersion: 1,
          completedRounds: 1,
          playedGames: {},
          result,
        },
      }}
      year={2}
      busy={false}
      progress={{ completed: 15, total: 15 }}
      onPlay={onPlay}
      onAdvance={onAdvance}
    />,
  );
  const table = screen.getByRole("table", { name: "League standings" });
  const team = result.league!.standings.find((team) => team.teamId === 0)!;
  const row = within(table)
    .getByRole("button", { name: /Kanto Basketball Club/ })
    .closest("tr")!;
  expect(within(row).getAllByRole("cell").at(-2)).toHaveTextContent(
    `${team.wins}–${team.losses}`,
  );
  expect(
    screen.queryByRole("button", { name: "Awards" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Play next game" }));
  expect(onPlay).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Simulate next game" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Simulate remaining season" }),
  );
  expect(onAdvance.mock.calls).toEqual([[1], [82]]);
});
