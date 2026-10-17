import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
import { snapshotMastery } from "../game/abilityMastery";
import { currentMasteryBanks } from "../game/currentMastery";
import * as setup from "../game/arcade/setup";
import { ArcadeMode } from "./ArcadeMode";
import { prepareArcadeTeams } from "./ArcadeSetup";
import type { Run } from "../game/types";
vi.mock("../arcade/renderer", () => ({
  loadArcadeAssets: async () => new Map(),
  drawArcade: () => {},
}));
afterEach(() => vi.restoreAllMocks());
const makeRun = (): Run => ({
  ...createRun("free", false, 11),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
const bank = (roster: Run["roster"], xp: number) =>
  Object.fromEntries(Object.values(roster).map((id) => [id!, xp]));
it("forwards the scheduled mastery rules and correctly oriented snapshots for an away official game", async () => {
  const run = makeRun(),
    teams = createLeague(run);
  const frozen = teams.map((t) => ({
    ...t,
    abilityMastery: bank(t.roster, t.id === 0 ? 75 : 700),
  }));
  const mastery = snapshotMastery(frozen[1], frozen[0])!;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform: () => {},
  } as unknown as CanvasRenderingContext2D);
  const create = vi.spyOn(setup, "createGame");
  render(
    <ArcadeMode
      run={{ ...run, abilityMasteryVersion: undefined }}
      onExit={() => {}}
      official={{
        teams,
        fixture: {
          id: "official",
          round: 0,
          homeTeamId: 1,
          awayTeamId: 0,
          seed: 7,
          mastery,
        },
        label: "Official game",
        onComplete: async () => {},
      }}
    />,
  );
  const tipoff = screen.getByRole("button", { name: "Tip off official game" });
  await waitFor(() => expect(tipoff).toBeEnabled());
  fireEvent.click(tipoff);
  expect(create).toHaveBeenCalledOnce();
  const state = create.mock.results[0].value as ReturnType<
    typeof setup.createGame
  >;
  expect(state.abilityMasteryVersion).toBe(1);
  expect(
    state.players.filter((p) => p.team === 0).every((p) => p.masteryXp === 75),
  ).toBe(true);
  expect(
    state.players.filter((p) => p.team === 1).every((p) => p.masteryXp === 700),
  ).toBe(true);
});
it("uses the latest playoff bank for practice previews without awarding XP", () => {
  const run = makeRun(),
    teams = createLeague(run),
    abilityMastery = { 0: bank(run.roster, 350) };
  const withProgress: Run = {
    ...run,
    leagueTeams: teams,
    playoffs: {
      abilityMastery,
      modelVersion: 2,
      seeds: [],
      series: [],
      players: [],
      finalsPlayers: [],
      championId: null,
      finalsMvp: null,
    },
  };
  const before = JSON.stringify(abilityMastery);
  expect(currentMasteryBanks(withProgress)).toBe(abilityMastery);
  expect(prepareArcadeTeams(withProgress).teams[0].abilityMastery).toEqual(
    abilityMastery[0],
  );
  expect(JSON.stringify(abilityMastery)).toBe(before);
});
