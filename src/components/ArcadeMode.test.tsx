import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "../game/playerProfile";
import {
  createEvaluationContext,
  evaluatePlayer,
} from "../game/teamEvaluation";
import { clamp } from "../game/ratings";
import * as arcadeSetup from "../game/arcade/setup";
import { ArcadeMode } from "./ArcadeMode";
vi.mock("../arcade/renderer", () => ({
  loadArcadeAssets: async () => new Map(),
  drawArcade: () => {},
}));
afterEach(() => vi.restoreAllMocks());
describe("arcade exhibition flow", () => {
  it("starts an exhibition, pauses, and requires an explicit abandon choice before returning to the unchanged roster", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: () => {},
    } as unknown as CanvasRenderingContext2D);
    const run = {
      ...createRun("free", false, 11),
      roster: {
        PG: 65,
        SG: 135,
        SF: 149,
        PF: 68,
        C: 143,
        B1: 121,
        B2: 6,
        B3: 131,
      },
    };
    const before = JSON.stringify(run),
      exit = vi.fn();
    render(<ArcadeMode run={run} onExit={exit} />);
    const tipoff = screen.getByRole("button", { name: /tip off/i });
    await waitFor(() => expect(tipoff).toBeEnabled());
    fireEvent.click(tipoff);
    expect(
      screen.getByLabelText(/five-on-five basketball court/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause game" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave exhibition" }));
    const dialog = screen.getByRole("dialog", { name: "Leave this game?" });
    expect(exit).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Keep playing" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Time out" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave exhibition" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(exit).toHaveBeenCalledOnce();
    expect(JSON.stringify(run)).toBe(before);
  });
  it("carries both clubs' developed skills through Tip off against the selected opponent", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: () => {},
    } as unknown as CanvasRenderingContext2D);
    // The spy calls the real engine: assertions inspect the resulting players.
    const create = vi.spyOn(arcadeSetup, "createGame");
    const run = {
      ...createRun("free", false, 11),
      roster: {
        PG: 65,
        SG: 135,
        SF: 149,
        PF: 68,
        C: 143,
        B1: 121,
        B2: 6,
        B3: 131,
      },
    };
    const teams = createLeague(run);
    const opponent = teams[2],
      opponentPlayer = opponent.roster.PG!;
    teams[0].development = { 65: { passing: 12 } };
    opponent.development = { [opponentPlayer]: { speed: -12 } };
    opponent.coach = { version: 1, id: "brock" };
    opponent.tactic = "interior";
    opponent.defense = "zone";
    // Exhibition rules follow the current run, even when its saved clubs are older.
    for (const team of teams) delete team.evaluationVersion;
    const savedRun = { ...run, leagueTeams: teams },
      before = JSON.stringify(savedRun);
    render(<ArcadeMode run={savedRun} onExit={() => {}} />);
    fireEvent.change(screen.getByLabelText("CPU team"), {
      target: { value: "2" },
    });
    const tipoff = screen.getByRole("button", { name: /tip off/i });
    await waitFor(() => expect(tipoff).toBeEnabled());
    fireEvent.click(tipoff);
    expect(
      screen.getByLabelText(/five-on-five basketball court/i),
    ).toBeInTheDocument();
    const state: ReturnType<typeof arcadeSetup.createGame> =
      create.mock.results[0].value;
    const homePlayer = state.players.find(
      (p) => p.team === 0 && p.pokemonId === 65,
    )!;
    const awayPlayer = state.players.find(
      (p) => p.team === 1 && p.pokemonId === opponentPlayer,
    )!;
    expect(homePlayer.attributes.passing).toBeCloseTo(
      Math.min(
        100,
        playerProfile(POKEMON_BY_ID.get(65)!).attributes.passing + 12,
      ),
    );
    expect(awayPlayer.attributes.speed).toBeCloseTo(
      Math.max(
        0,
        playerProfile(POKEMON_BY_ID.get(opponentPlayer)!).attributes.speed - 12,
      ),
    );
    expect(state.names[1]).toBe(opponent.name);
    expect(state.evaluationVersion).toBe(1);
    expect(state.physicalAbilityVersion).toBe(1);
    expect(state.chemistryVersion).toBe(1);
    const context = createEvaluationContext({
      ...opponent,
      abilityVersion: 1,
      engineRules: { abilities: true },
    });
    expect(awayPlayer.roleScores?.PG).toBeCloseTo(
      clamp(evaluatePlayer(context, opponentPlayer, "PG").score),
    );
    expect(JSON.stringify(savedRun)).toBe(before);
  });
});
