import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRun, placePokemon } from "../game/draft";
import { enterOffseason, archiveFranchiseSeason } from "../game/franchise";
import { simulateSeason } from "../game/season";
import { simulatePlayoffs } from "../game/playoffs";
import { initialState } from "../game/state";
import { ROSTER_SLOTS, type GameState } from "../game/types";
import { CareerDetail } from "./CareerDetail";
import { HistoricalGames } from "./HistoricalGames";

let finished: GameState;
beforeAll(() => {
  let run = createRun("free", true, 82);
  [129, 150, 149, 68, 143, 9, 94, 59].forEach((id, index) => {
    run = placePokemon(run, id, ROSTER_SLOTS[index]);
  });
  const result = simulateSeason(run);
  finished = {
    ...initialState(82),
    run: {
      ...run,
      result,
      playoffs: simulatePlayoffs(result.league!, run.seasonSeed),
    },
  };
}, 30000);
describe("franchise detail dialogs", () => {
  it("labels unavailable old rows honestly while retaining career totals and keyboard dismissal", () => {
    const state = enterOffseason(finished),
      close = vi.fn();
    render(
      <CareerDetail
        pokemonId={129}
        franchise={state.franchise!}
        run={state.run}
        onClose={close}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: /Magikarp/ });
    expect(
      within(dialog).getByText(/Season detail unavailable/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Regular season" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Playoffs" }));
    expect(
      within(dialog).getByRole("button", { name: "Playoffs" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });
  it("does not invent old game boxes", () => {
    const state = enterOffseason(finished);
    render(
      <HistoricalGames
        season={state.franchise!.history[0]}
        onClose={() => {}}
      />,
    );
    expect(
      screen.getByText(/Detailed game history is unavailable/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /View box/ }),
    ).not.toBeInTheDocument();
  });
  it("replays archived games, filters teams and opens a box from frozen clubs", async () => {
    const state = archiveFranchiseSeason(finished);
    render(
      <HistoricalGames
        season={state.franchise!.history[0]}
        onClose={() => {}}
      />,
    );
    const filter = await screen.findByRole("combobox", { name: "Club" });
    expect(filter).toHaveValue("0");
    const games = await screen.findAllByRole(
      "button",
      { name: /View box/ },
      { timeout: 10000 },
    );
    expect(games).toHaveLength(82);
    fireEvent.click(games[0]);
    expect(
      screen.getByRole("button", { name: "Close box score" }),
    ).toBeInTheDocument();
  }, 15000);
});
