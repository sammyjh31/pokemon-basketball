import { abilitiesEnabled } from "../game/abilities";
import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
import * as setup from "../game/arcade/setup";
import type { ArcadeState } from "../game/arcade/types";
import type { OfficialGame } from "../game/franchiseFeatures";
import type { LeagueFixture } from "../game/types";
import {
  createEvaluationContext,
  evaluatePlayer,
} from "../game/teamEvaluation";
import { clamp } from "../game/ratings";
import { ArcadeMode } from "./ArcadeMode";
import { OfficialArcadeResults } from "./OfficialArcade";

vi.mock("../arcade/renderer", () => ({
  loadArcadeAssets: async () => new Map(),
  drawArcade: () => {},
}));
afterEach(() => vi.restoreAllMocks());
const run = {
  ...createRun("free", false, 11),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
};
const teams = createLeague(run);
const fixture: LeagueFixture = {
  id: "r0-t1-t0",
  round: 0,
  homeTeamId: 1,
  awayTeamId: 0,
  seed: 357,
};
const official = {
  fixture,
  teams,
  label: "Regular season · Game 1",
  onComplete: async () => {},
};

function completedGame(): ArcadeState {
  const state = setup.createGame({
    teams: [teams[0], teams[1]],
    seed: fixture.seed,
    official: true,
    ...(abilitiesEnabled(teams[0]) ? { abilityVersion: 1 as const } : {}),
  });
  state.phase = "final";
  state.period = 4;
  state.clock = 0;
  state.elapsed = 240;
  state.score = [2, 0];
  for (const p of state.players.filter((p) => p.active)) {
    p.stats.seconds = 240;
    p.stats.plusMinus = p.team === 0 ? 2 : -2;
  }
  Object.assign(state.players[0].stats, {
    points: 2,
    fgm: 1,
    fga: 1,
    rimFgm: 1,
    rimFga: 1,
  });
  state.events = [
    { id: 0, kind: "score", player: 0, team: 0, value: 2, time: 10 },
    ...Array.from({ length: 19 }, (_, i) => ({
      id: i + 1,
      kind: "pass" as const,
      player: 0,
      team: 0 as const,
      time: 11 + i,
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      id: i + 20,
      kind: "period" as const,
      player: null,
      team: 0 as const,
      time: (i + 1) * 60,
    })),
  ];
  return state;
}

describe("official arcade flow", () => {
  it.each([false, true])(
    "uses scheduled clubs' evaluation and ability settings rather than the run flag (modern: %s)",
    async (modern) => {
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        setTransform: () => {},
      } as unknown as CanvasRenderingContext2D);
      const create = vi.spyOn(setup, "createGame");
      const actualTeams = structuredClone(teams);
      for (const team of actualTeams) {
        team.evaluationVersion = modern ? 1 : undefined;
        team.engineRules = {
          version: 1,
          abilities: false,
          adaptiveCoaching: true,
          familiarity: 0,
        };
      }
      actualTeams[1].coach = { version: 1, id: "brock" };
      actualTeams[1].development = {
        [actualTeams[1].roster.PG!]: { passing: 20 },
      };
      render(
        <ArcadeMode
          run={{ ...run, evaluationVersion: modern ? undefined : 1 }}
          onExit={() => {}}
          official={{ ...official, teams: actualTeams }}
        />,
      );
      const tipoff = screen.getByRole("button", {
        name: "Tip off official game",
      });
      await waitFor(() => expect(tipoff).toBeEnabled());
      fireEvent.click(tipoff);
      const state = create.mock.results[0].value as ArcadeState;
      expect(state.evaluationVersion).toBe(modern ? 1 : undefined);
      expect(state).not.toHaveProperty("abilityVersion");
      if (modern) {
        const context = createEvaluationContext(actualTeams[1]);
        expect(state.players[8].roleScores?.PG).toBeCloseTo(
          clamp(evaluatePlayer(context, actualTeams[1].roster.PG!, "PG").score),
        );
      } else expect(state.players[8]).not.toHaveProperty("roleScores");
    },
  );

  it("starts only the scheduled away opponent with the fixture seed and explains unfinished exits", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: () => {},
    } as unknown as CanvasRenderingContext2D);
    const create = vi.spyOn(setup, "createGame"),
      onComplete = vi.fn(async () => {}),
      onExit = vi.fn();
    render(
      <ArcadeMode
        run={run}
        onExit={onExit}
        official={{ ...official, onComplete }}
      />,
    );
    expect(screen.queryByLabelText("CPU team")).not.toBeInTheDocument();
    const tipoff = screen.getByRole("button", {
      name: "Tip off official game",
    });
    await waitFor(() => expect(tipoff).toBeEnabled());
    fireEvent.click(tipoff);
    const state = create.mock.results[0].value as ArcadeState;
    expect(state.official).toBe(true);
    expect(state.officialSeed).toBe(fixture.seed);
    expect(state.names).toEqual([teams[0].name, teams[1].name]);
    fireEvent.click(screen.getByRole("button", { name: "Pause game" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Leave official game" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Leave this game?" }),
    ).toHaveTextContent(/fixture stays pending/i);
    fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(onExit).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("submits once under StrictMode and gates Continue until the official result saves", async () => {
    let resolve!: () => void;
    const onComplete = vi.fn<(game: OfficialGame) => Promise<void>>(
        () =>
          new Promise<void>((done) => {
            resolve = done;
          }),
      ),
      onExit = vi.fn();
    const state = completedGame();
    render(
      <StrictMode>
        <OfficialArcadeResults
          state={state}
          official={{ ...official, onComplete }}
          onExit={onExit}
        />
      </StrictMode>,
    );
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(onComplete.mock.calls[0][0]).toMatchObject({
      fixtureId: fixture.id,
      courtScore: [0, 2],
      match: { homeScore: 0, awayScore: 24 },
    });
    expect(
      screen.getByRole("button", { name: "Continue to franchise" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Rematch" }),
    ).not.toBeInTheDocument();
    await act(async () => resolve());
    fireEvent.click(
      screen.getByRole("button", { name: "View official box score" }),
    );
    const box = screen.getByRole("dialog");
    const playerRow = within(
      within(box).getByRole("table", {
        name: `${teams[0].name} player box score`,
      }),
    )
      .getByRole("rowheader", { name: /Alakazam/ })
      .closest("tr")!;
    expect(within(playerRow).getAllByRole("cell")[1]).toHaveTextContent("24");
    fireEvent.keyDown(box, { key: "Escape" });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to franchise" }),
    );
    expect(onExit).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("retains a failed result and retries that exact game instead of rerolling", async () => {
    const onComplete = vi
      .fn()
      .mockRejectedValueOnce(new Error("Storage full"))
      .mockResolvedValueOnce(undefined);
    render(
      <OfficialArcadeResults
        state={completedGame()}
        official={{ ...official, onComplete }}
        onExit={() => {}}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Storage full");
    expect(
      screen.getByRole("button", { name: "Continue to franchise" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Retry saving result" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Continue to franchise" }),
      ).toBeEnabled(),
    );
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete.mock.calls[1][0]).toEqual(onComplete.mock.calls[0][0]);
  });

  it("converts the complete game history rather than the HUD's truncated event list", async () => {
    const state = completedGame();
    vi.spyOn(setup, "createGame").mockReturnValue(state);
    const onComplete = vi.fn<(game: OfficialGame) => Promise<void>>(
      async () => {},
    );
    render(
      <ArcadeMode
        run={run}
        onExit={() => {}}
        official={{ ...official, onComplete }}
      />,
    );
    const tipoff = screen.getByRole("button", {
      name: "Tip off official game",
    });
    await waitFor(() => expect(tipoff).toBeEnabled());
    fireEvent.click(tipoff);
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(onComplete.mock.calls[0][0].match.awayScore).toBe(24);
    expect(screen.getByText(/Court score: 0–2/)).toBeInTheDocument();
  });
});
