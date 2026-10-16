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
  it("keeps a released player's seasons and last developed skills without inventing a live row", () => {
    const state = enterOffseason(finished),
      f = state.franchise!;
    const first = f.history[0];
    f.history = [
      first,
      {
        ...first,
        year: 2,
        rosters: first.rosters.map((ids) =>
          ids.map((id) => (id === 129 ? 252 : id)),
        ),
      },
    ];
    f.teams = f.teams.map((team) => ({
      ...team,
      roster: Object.fromEntries(
        Object.entries(team.roster).map(([slot, id]) => [
          slot,
          id === 129 ? 252 : id,
        ]),
      ) as typeof team.roster,
    }));
    f.year = 3;
    f.phase = "season";
    render(
      <CareerDetail
        pokemonId={129}
        franchise={f}
        run={{ ...state.run, result: null, playoffs: undefined }}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: /Magikarp/ });
    expect(within(dialog).getByText(/Released/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/LIVE/)).not.toBeInTheDocument();
    const table = within(dialog).getByRole("table", { name: /season rows/ });
    expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
  });
  it("shows recorded defense for each season and career with honest zero-minute rates", () => {
    const state = archiveFranchiseSeason(finished),
      f = state.franchise!;
    const player = f.history[0].replay!.regularPlayers.find(
      (p) => p.pokemonId === 129,
    )!;
    Object.assign(player, {
      gamesPlayed: 2,
      minutes: 60,
      defensiveRebounds: 18,
      steals: 4,
      blocks: 2,
      fouls: 6,
    });
    Object.assign(f.careers.find((p) => p.pokemonId === 129)!.regular, {
      gamesPlayed: 2,
      minutes: 60,
      defensiveRebounds: 18,
      steals: 4,
      blocks: 2,
      fouls: 6,
    });
    Object.assign(f.careers.find((p) => p.pokemonId === 129)!.playoffs, {
      gamesPlayed: 0,
      minutes: 0,
      defensiveRebounds: 0,
      steals: 0,
      blocks: 0,
      fouls: 0,
    });
    render(
      <CareerDetail
        pokemonId={129}
        franchise={f}
        run={state.run}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: /Magikarp/ });
    const category = within(dialog).getByRole("group", {
      name: "Player stat category",
    });
    fireEvent.click(within(category).getByRole("button", { name: "Defense" }));
    const table = within(dialog).getByRole("table", { name: /season rows/ });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual([
      "YEAR",
      "CLUB",
      "GP",
      "MIN",
      "DREB",
      "STL",
      "BLK",
      "STL+BLK",
      "PF",
      "DREB/36",
      "STL/36",
      "BLK/36",
    ]);
    const seasonCells = () =>
      Array.from(table.querySelectorAll("tbody tr td"))
        .slice(1)
        .map((cell) => cell.textContent);
    const careerCells = () =>
      Array.from(table.querySelectorAll("tfoot tr td")).map(
        (cell) => cell.textContent,
      );
    expect(seasonCells()).toEqual([
      "2",
      "30.0",
      "9.0",
      "2.0",
      "1.0",
      "3.0",
      "3.0",
      "10.8",
      "2.4",
      "1.2",
    ]);
    expect(careerCells()).toEqual(seasonCells());
    fireEvent.click(within(dialog).getByRole("button", { name: "Totals" }));
    expect(seasonCells()).toEqual([
      "2",
      "60",
      "18",
      "4",
      "2",
      "6",
      "6",
      "10.8",
      "2.4",
      "1.2",
    ]);
    expect(careerCells()).toEqual(seasonCells());
    fireEvent.click(within(dialog).getByRole("button", { name: "Playoffs" }));
    expect(careerCells().slice(-3)).toEqual(["—", "—", "—"]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Per game" }));
    expect(careerCells()).toEqual([
      "0",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
    ]);
    fireEvent.click(
      within(category).getByRole("button", { name: "All stats" }),
    );
    expect(
      within(table).getByRole("columnheader", { name: "PTS" }),
    ).toBeInTheDocument();
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
      { timeout: 30000 }, // Reconstructs the full archived court-model season.
    );
    expect(games).toHaveLength(82);
    fireEvent.click(games[0]);
    expect(
      screen.getByRole("button", { name: "Close box score" }),
    ).toBeInTheDocument();
  }, 15000);
});
