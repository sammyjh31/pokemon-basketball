import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
import { simulateMatch } from "../game/match";
import type { LeagueGameSummary } from "../game/types";
import { LeagueBoxScore } from "./LeagueBoxScore";
import { POKEMON_BY_ID } from "../data/pokemon";

const run = {
  ...createRun("free", false, 11),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
};
const teams = createLeague(run);
const replay = simulateMatch(teams[0], teams[1], 91);
const game: LeagueGameSummary = {
  id: "ui-replay",
  round: 0,
  homeTeamId: 0,
  awayTeamId: 1,
  seed: 91,
  homeScore: replay.homeScore,
  awayScore: replay.awayScore,
  overtimePeriods: replay.overtimePeriods,
};
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open match</button>
      {open && (
        <LeagueBoxScore
          game={game}
          teams={teams}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
describe("league box scores", () => {
  it("replays later fixtures using their pregame familiarity and refreshes when that snapshot changes", () => {
    const chemistry = { home: Array(28).fill(600), away: Array(28).fill(600) };
    const later = simulateMatch(teams[0], teams[1], 91, { chemistry });
    const fixture = {
      ...game,
      round: 20,
      chemistry,
      homeScore: later.homeScore,
      awayScore: later.awayScore,
      overtimePeriods: later.overtimePeriods,
    };
    const view = render(
      <LeagueBoxScore game={fixture} teams={teams} onClose={() => {}} />,
    );
    const homeTable = screen.getByRole("table", {
      name: `${teams[0].name} player box score`,
    });
    const totals = within(homeTable)
      .getByRole("rowheader", { name: "Team totals" })
      .closest("tr")!;
    expect(within(totals).getAllByRole("cell")[1]).toHaveTextContent(
      String(later.homeScore),
    );
    for (const box of later.homeBox) {
      const rows = within(homeTable).getAllByRole("row");
      const row = rows.find((row) =>
        row.textContent?.includes(POKEMON_BY_ID.get(box.pokemonId)!.name),
      )!;
      expect(within(row).getAllByRole("cell")[1]).toHaveTextContent(
        String(box.points),
      );
    }
    expect(
      screen.getAllByText("Earned familiarity 50 / 100").length,
    ).toBeGreaterThan(0);
    view.rerender(
      <LeagueBoxScore
        game={{
          ...fixture,
          chemistry: { home: Array(28).fill(1200), away: Array(28).fill(1200) },
        }}
        teams={teams}
        onClose={() => {}}
      />,
    );
    expect(
      screen.getAllByText("Earned familiarity 67 / 100").length,
    ).toBeGreaterThan(0);
  });
  it("replays all sixteen players with matching team and period totals and restores keyboard focus", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open match" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", {
      name: "Close box score",
    });
    expect(close).toHaveFocus();
    for (const [team, score] of [
      [teams[0], game.homeScore],
      [teams[1], game.awayScore],
    ] as const) {
      const table = within(dialog).getByRole("table", {
        name: `${team.name} player box score`,
      });
      expect(within(table).getAllByRole("row")).toHaveLength(10);
      const totals = within(table)
        .getByRole("rowheader", { name: "Team totals" })
        .closest("tr")!;
      expect(within(totals).getAllByRole("cell")[1]).toHaveTextContent(
        String(score),
      );
      const playerBoxes = team.id === 0 ? replay.homeBox : replay.awayBox;
      const headers = within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent);
      for (const [label, key] of [
        ["DREB", "defensiveRebounds"],
        ["OREB", "offensiveRebounds"],
      ] as const) {
        expect(
          within(table).getByRole("columnheader", { name: label }),
        ).toBeInTheDocument();
        expect(
          within(totals).getAllByRole("cell")[headers.indexOf(label) - 1],
        ).toHaveTextContent(
          String(playerBoxes.reduce((sum, p) => sum + p[key], 0)),
        );
      }
      expect(
        within(table).getByRole("columnheader", { name: "PF" }),
      ).toBeInTheDocument();
      expect(
        within(table).getByRole("columnheader", { name: "RIM M–A" }),
      ).toBeInTheDocument();
    }
    const periods = within(dialog).getByRole("table", {
      name: "Period scores",
    });
    for (const row of within(periods).getAllByRole("row").slice(1)) {
      const cells = within(row)
        .getAllByRole("cell")
        .map((cell) => Number(cell.textContent));
      expect(cells.slice(0, -1).reduce((sum, n) => sum + n, 0)).toBe(
        cells.at(-1),
      );
    }
    expect(
      within(dialog).getByRole("table", {
        name: "Play types and largest leads",
      }),
    ).toHaveTextContent("Pick & roll");
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(
      screen.getByRole("region", { name: "Scrollable play types" }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
