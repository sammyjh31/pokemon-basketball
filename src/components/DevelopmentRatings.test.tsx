import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  DEVELOPMENT_SKILLS,
  type PlayerDevelopment,
} from "../game/developmentTypes";
import { initialState } from "../game/state";
import { Court } from "./Court";
import { BenchPanel } from "./BenchPanel";
import { ScoutReport } from "./ScoutReport";
import { LeaguePanel } from "./LeaguePanel";
import type { LeagueTeam } from "../game/types";

const offsets = Object.fromEntries(
  DEVELOPMENT_SKILLS.map((skill) => [skill, 30]),
);
const development: PlayerDevelopment = { 1: offsets };
const ratings = {
  offense: 60,
  defense: 60,
  overall: 60,
  filled: 5,
  complete: true,
};

describe("developed player displays", () => {
  it("updates court and bench ratings and stamina from the supplied season development", () => {
    const run = initialState(1).run;
    run.roster = { ...run.roster, PG: 1 };
    const props = {
      run,
      ratings: { ...ratings, filled: 1, complete: false },
      pending: null,
      swap: null,
      onSlot: vi.fn(),
    };
    const { rerender } = render(<Court {...props} onReset={vi.fn()} />);
    const baseline = screen.getByRole("button", {
      name: "PG slot: Bulbasaur",
    }).textContent;
    rerender(<Court {...props} onReset={vi.fn()} development={development} />);
    expect(
      screen.getByRole("button", { name: "PG slot: Bulbasaur" }).textContent,
    ).not.toBe(baseline);
    run.roster = { ...run.roster, PG: null, B1: 1 };
    rerender(
      <BenchPanel
        {...props}
        onAutoFill={vi.fn()}
        onTactic={vi.fn()}
        onRotation={vi.fn()}
        onDefense={vi.fn()}
      />,
    );
    const bench = screen.getByRole("button", { name: "B1 slot: Bulbasaur" });
    const benchFit = within(bench).getByText(/FIT/).textContent;
    const benchStamina = within(bench).getByText(/STA/).textContent;
    rerender(
      <BenchPanel
        {...props}
        onAutoFill={vi.fn()}
        onTactic={vi.fn()}
        onRotation={vi.fn()}
        onDefense={vi.fn()}
        development={development}
      />,
    );
    const developedBench = screen.getByRole("button", {
      name: "B1 slot: Bulbasaur",
    });
    expect(within(developedBench).getByText(/FIT/).textContent).not.toBe(
      benchFit,
    );
    expect(within(developedBench).getByText(/STA/).textContent).not.toBe(
      benchStamina,
    );
  });

  it("updates scouting skills while preserving factual Pokémon measurements", () => {
    const mon = POKEMON_BY_ID.get(1)!;
    const { rerender } = render(<ScoutReport mon={mon} />);
    const original = screen.getByRole("region", {
      name: "Bulbasaur scouting report",
    }).textContent;
    rerender(
      <ScoutReport
        mon={mon}
        development={{ passing: 30, speed: 30, stamina: -30 }}
      />,
    );
    const report = screen.getByRole("region", {
      name: "Bulbasaur scouting report",
    });
    expect(report.textContent).not.toBe(original);
    expect(report).toHaveTextContent("0.7 m · 6.9 kg");
  });

  it("uses the league snapshot development for roster position fit", () => {
    const team: LeagueTeam = {
      id: 0,
      name: "Your team",
      roster: {
        PG: 1,
        SG: null,
        SF: null,
        PF: null,
        C: null,
        B1: null,
        B2: null,
        B3: null,
      },
      tactic: "balanced",
      defense: "man",
      rotation: "balanced",
      ratings,
    };
    const league = {
      teams: [team],
      players: [],
      games: [],
      standings: [],
      awards: [],
      allLeague: [],
      allDefense: [],
    };
    const { rerender } = render(<LeaguePanel league={league} />);
    fireEvent.click(screen.getByRole("button", { name: "Team rosters" }));
    const baseline = within(
      screen.getByRole("table", { name: /roster and season statistics/ }),
    ).getAllByRole("cell")[2].textContent;
    rerender(
      <LeaguePanel league={{ ...league, teams: [{ ...team, development }] }} />,
    );
    expect(
      within(
        screen.getByRole("table", { name: /roster and season statistics/ }),
      ).getAllByRole("cell")[2].textContent,
    ).not.toBe(baseline);
  });
});
