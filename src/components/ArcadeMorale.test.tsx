import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
import { snapshotMorale, moraleProfile } from "../game/playerMorale";
import { playerProfile } from "../game/playerProfile";
import { POKEMON_BY_ID } from "../data/pokemon";
import * as setup from "../game/arcade/setup";
import { ArcadeMode } from "./ArcadeMode";
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
const bank = (roster: Run["roster"], score: number) =>
  Object.fromEntries(
    Object.values(roster).map((id) => [
      id!,
      { score, minutes: 30, success: 50, disruption: 0, games: 10 },
    ]),
  );
function capture() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform: () => {},
  } as unknown as CanvasRenderingContext2D);
  return vi.spyOn(setup, "createGame");
}

it("starts an away official game with the fixture's frozen morale and scheduled rule version", async () => {
  const run = makeRun(),
    teams = createLeague(run),
    create = capture();
  const frozen = teams.map((t) => ({
    ...t,
    morale: bank(t.roster, t.id === 0 ? 20 : 80),
  }));
  const morale = snapshotMorale(frozen[1], frozen[0])!;
  render(
    <ArcadeMode
      run={{ ...run, moraleVersion: undefined, personalityVersion: undefined }}
      onExit={() => {}}
      official={{
        teams,
        fixture: {
          id: "playoff-pending",
          round: 0,
          homeTeamId: 1,
          awayTeamId: 0,
          seed: 7,
          morale,
        },
        label: "Playoff game",
        onComplete: async () => {},
      }}
    />,
  );
  const tipoff = screen.getByRole("button", { name: "Tip off official game" });
  await waitFor(() => expect(tipoff).toBeEnabled());
  fireEvent.click(tipoff);
  const state = create.mock.results[0].value as ReturnType<
    typeof setup.createGame
  >;
  expect(state.moraleVersion).toBe(1);
  expect(state.personalityVersion).toBe(1);
  expect(state.moraleInitial).toEqual({ home: morale.away, away: morale.home });
  expect(state.players.find((p) => p.pokemonId === 65)!.attributes).toEqual(
    moraleProfile(playerProfile(POKEMON_BY_ID.get(65)!), frozen[0], 65)
      .attributes,
  );
  expect(teams[0].morale?.[65].score).toBe(50);
});

it("uses the latest playoff bank for exhibition while keeping season-start clubs unchanged", async () => {
  const run = makeRun(),
    teams = createLeague(run),
    create = capture();
  const current = { ...teams[0], morale: bank(run.roster, 90) };
  run.leagueTeams = teams;
  run.playoffs = {
    modelVersion: 2,
    seeds: [],
    series: [],
    players: [],
    finalsPlayers: [],
    championId: null,
    finalsMvp: null,
    morale: { 0: current.morale },
  };
  render(<ArcadeMode run={run} onExit={() => {}} />);
  const tipoff = screen.getByRole("button", { name: /tip off/i });
  await waitFor(() => expect(tipoff).toBeEnabled());
  fireEvent.click(tipoff);
  const state = create.mock.results[0].value as ReturnType<
    typeof setup.createGame
  >;
  expect(state.moraleVersion).toBe(1);
  expect(state.personalityVersion).toBe(1);
  expect(state.players.find((p) => p.pokemonId === 65)!.attributes).toEqual(
    moraleProfile(playerProfile(POKEMON_BY_ID.get(65)!), current, 65)
      .attributes,
  );
  expect(teams[0].morale?.[65].score).toBe(50);
});
