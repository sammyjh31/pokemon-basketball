import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import App from "../App";
import { gameReducer, initialState } from "../game/state";
import { POSITIONS, ROSTER_SLOTS, type GameState } from "../game/types";
import { STORAGE_KEY, type StorageLike } from "../game/persistence";
import { simulatePlayoffs } from "../game/playoffs";

let finished: GameState;
const memory = (value: string | null = null): StorageLike => ({
  getItem: () => value,
  setItem: (_key, next) => {
    value = next;
  },
});
beforeAll(() => {
  let state = initialState(47);
  for (const position of ROSTER_SLOTS)
    state = gameReducer(state, {
      type: "PLACE",
      position,
      pokemonId: state.run.offerIds[0],
    });
  state = gameReducer(state, { type: "SIMULATE" });
  finished = {
    ...state,
    run: {
      ...state.run,
      playoffs: simulatePlayoffs(
        state.run.result!.league!,
        state.run.seasonSeed,
      ),
    },
  };
}, 20000);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("continues a completed league into the next season and restores its careers without recounting challenge attempts", async () => {
  vi.useFakeTimers();
  const storage = memory();
  let mounted = render(<App initial={finished} storage={storage} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Continue as franchise" }),
  );
  const archived = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(archived.franchise?.history).toHaveLength(1);
  expect(archived.franchise?.careers).toHaveLength(240);
  expect(
    screen.queryByRole("region", { name: "Your starting lineup" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start season 2" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Open rookie draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Begin rookie draft" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Draft recommended pick" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Draft recommended pick" }),
  );
  const drafted = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(drafted.franchise!.rookieDrafts![0].picks).toHaveLength(60);
  fireEvent.click(screen.getByRole("button", { name: "Start season 2" }));
  const ready = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(ready.franchise?.year).toBe(2);
  expect(ready.run.result).toBeNull();
  expect(ready.run.playoffs).toBeUndefined();
  expect(ready.run.leagueTeams).toEqual(ready.franchise!.teams);
  expect(ready.franchise!.teams[0]).toEqual(drafted.franchise!.teams[0]);
  expect(ready.franchise!.freeAgency?.cpuYears).toEqual([1]);
  expect(screen.getByRole("button", { name: "Lineup builder" })).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", {
      name: `PG slot: ${nameOf(ready.run.roster.PG!)}`,
    }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: `B1 slot: ${nameOf(ready.run.roster.B1!)}`,
    }),
  );
  const swapped = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(swapped.run.roster.PG).toBe(ready.run.roster.B1);
  fireEvent.change(screen.getByLabelText("Coaching style"), {
    target: { value: "pace" },
  });
  mounted.unmount();
  mounted = render(
    <StrictMode>
      <App storage={storage} />
    </StrictMode>,
  );
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(screen.getByLabelText("Coaching style")).toHaveValue("pace");
  fireEvent.click(
    screen.getByRole("button", { name: /Simulate remaining season/i }),
  );
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  const skip = screen.queryByRole("button", { name: "Skip reveal" });
  if (skip) fireEvent.click(skip);
  const played = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(played.run.result?.modelVersion).toBe(6);
  expect(played.records).toEqual(finished.records);
  expect(played.franchise?.history).toHaveLength(1);
  expect(screen.getByRole("region", { name: "Playoffs" })).toBeInTheDocument();
  mounted.unmount();
  render(<App storage={storage} />);
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(played);
  expect(
    screen.getByRole("button", { name: "Career stats" }),
  ).toBeInTheDocument();
}, 120000); // Multiple full court-model simulations and restore passes.

import { suggestTrades } from "../game/tradeMarket";
import { POKEMON_BY_ID } from "../data/pokemon";
const nameOf = (id: number) => POKEMON_BY_ID.get(id)!.name;

it("saves an accepted offseason trade, keeps careers, and restores both rosters", async () => {
  vi.useFakeTimers();
  const offseason = enterOffseason(finished),
    franchise = offseason.franchise!;
  const offer = suggestTrades(franchise, { packageSize: 2, limit: 1 })[0]
    ?.offer;
  expect(offer).toBeDefined();
  const storage = memory();
  const mounted = render(<App initial={offseason} storage={storage} />);
  fireEvent.click(screen.getByRole("button", { name: "Trade market" }));
  fireEvent.change(screen.getByLabelText("Trade partner"), {
    target: { value: String(offer.teamId) },
  });
  for (const id of offer.giveIds)
    fireEvent.click(screen.getByLabelText(`Send ${nameOf(id)}`));
  for (const id of offer.receiveIds)
    fireEvent.click(screen.getByLabelText(`Receive ${nameOf(id)}`));
  fireEvent.click(screen.getByRole("button", { name: "Complete trade" }));
  const traded = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(traded.franchise!.trades).toHaveLength(1);
  expect(traded.franchise!.trades[0]).toMatchObject({
    year: 1,
    ...offer,
    packageVersion: 1,
  });
  expect(Object.values(traded.franchise!.teams[0].roster)).toContain(
    offer.receiveIds[0],
  );
  expect(Object.values(traded.franchise!.teams[offer.teamId].roster)).toContain(
    offer.giveIds[0],
  );
  expect(traded.franchise!.careers).toEqual(franchise.careers);
  expect(traded.run).toEqual(offseason.run);
  mounted.unmount();
  render(<App storage={storage} />);
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(traded);
  expect(
    screen.getByRole("region", { name: "Offseason roster management" }),
  ).toHaveTextContent(nameOf(offer.receiveIds[0]));
  fireEvent.click(
    screen.getByRole("button", { name: "End franchise / new draft" }),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    /career stats, trades and championship history/,
  );
  fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
  expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(traded);
}, 20000);

import {
  applyTrade,
  enterOffseason,
  evaluateTrade,
  startFranchiseSeason,
} from "../game/franchise";

it.each(["offseason", "season"] as const)(
  "preserves the %s franchise and uses its traded rosters when entering and leaving arcade",
  async (phase) => {
    const offseason = enterOffseason(finished),
      franchise = offseason.franchise!;
    const offer = franchise.teams
      .slice(1)
      .flatMap((team) =>
        Object.values(franchise.teams[0].roster).flatMap((giveId) =>
          Object.values(team.roster).map((receiveId) => ({
            teamId: team.id,
            giveId: giveId!,
            receiveId: receiveId!,
          })),
        ),
      )
      .find(
        ({ teamId, giveId, receiveId }) =>
          evaluateTrade(franchise, teamId, giveId, receiveId).accepted,
      )!;
    const traded = applyTrade(
      offseason,
      offer.teamId,
      offer.giveId,
      offer.receiveId,
    );
    const state =
      phase === "season" ? startFranchiseSeason(traded, 9123) : traded;
    const before = JSON.stringify(state),
      storage = memory();
    render(<App initial={state} storage={storage} />);
    const saved = storage.getItem(STORAGE_KEY);
    fireEvent.click(screen.getByRole("button", { name: "Play arcade" }));
    await screen.findByRole("button", { name: /Tip off/i });
    const rosterText =
      screen.getByRole("list", { name: "Starting five" }).textContent! +
      screen.getByRole("list", { name: "Your bench" }).textContent!;
    expect(rosterText).toContain(nameOf(offer.receiveId));
    expect(rosterText).not.toContain(nameOf(offer.giveId));
    fireEvent.change(screen.getByRole("combobox", { name: "CPU team" }), {
      target: { value: String(offer.teamId) },
    });
    const opponent = state.franchise!.teams[offer.teamId];
    for (const slot of POSITIONS)
      expect(screen.getByLabelText("Opponent starting five")).toHaveTextContent(
        nameOf(opponent.roster[slot]!),
      );
    fireEvent.click(screen.getByRole("button", { name: /Back to roster/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Career stats" }),
      ).toBeInTheDocument(),
    );
    expect(storage.getItem(STORAGE_KEY)).toBe(saved);
    expect(JSON.stringify(state)).toBe(before);
  },
  10000,
);

it("moves keyboard focus to the offseason hub after continuation", () => {
  render(<App initial={finished} storage={memory()} />);
  const button = screen.getByRole("button", { name: "Continue as franchise" });
  button.focus();
  fireEvent.click(button);
  expect(
    screen.getByRole("heading", { name: "Build a legacy." }),
  ).toHaveFocus();
});
