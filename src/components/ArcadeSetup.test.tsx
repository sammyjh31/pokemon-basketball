import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
import { ArcadeSetupScreen, prepareArcadeTeams } from "./ArcadeSetup";

const run = {
  ...createRun("free", false, 11),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
};
const league = createLeague(run);

describe("arcade setup", () => {
  it("rejects legacy five-player rosters with the missing bench slots and a path back", () => {
    const incomplete = {
      ...run,
      roster: { ...run.roster, B1: null, B2: null, B3: null },
    };
    const prepared = prepareArcadeTeams(incomplete);
    const exit = vi.fn();
    render(
      <ArcadeSetupScreen
        roster={incomplete.roster}
        teams={prepared.teams}
        error={prepared.error}
        opponentId={1}
        onOpponent={() => {}}
        ready={false}
        onStart={() => {}}
        onExit={exit}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/B1.*B2.*B3/);
    expect(screen.getByRole("button", { name: /tip off/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /back to roster/i }));
    expect(exit).toHaveBeenCalledOnce();
  });
  it("reuses existing valid league opponents without altering a saved season", () => {
    const saved = {
      ...run,
      result: {
        games: [],
        wins: 0,
        losses: 0,
        mvpId: 65,
        league: {
          teams: league,
          games: [],
          players: [],
          standings: [],
          awards: [],
          allLeague: [],
          allDefense: [],
        },
      },
    };
    const before = JSON.stringify(saved);
    const prepared = prepareArcadeTeams(saved);
    expect(prepared.error).toBeNull();
    expect(prepared.teams[1]).toBe(league[1]);
    expect(JSON.stringify(saved)).toBe(before);
  });
  it("shows five starters and three reserves and requires assets before tipoff", () => {
    const start = vi.fn();
    const { rerender } = render(
      <ArcadeSetupScreen
        roster={run.roster}
        teams={league}
        error={null}
        opponentId={1}
        onOpponent={() => {}}
        ready={false}
        onStart={start}
        onExit={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /tip off/i })).toBeDisabled();
    expect(
      screen.getByRole("list", { name: "Starting five" }).children,
    ).toHaveLength(5);
    expect(
      screen.getByRole("list", { name: "Your bench" }).children,
    ).toHaveLength(3);
    rerender(
      <ArcadeSetupScreen
        roster={run.roster}
        teams={league}
        error={null}
        opponentId={1}
        onOpponent={() => {}}
        ready
        onStart={start}
        onExit={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /tip off/i }));
    expect(start).toHaveBeenCalledOnce();
  });
});
