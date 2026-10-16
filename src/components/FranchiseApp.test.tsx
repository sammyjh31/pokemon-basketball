import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import App from "../App";
import { gameReducer, initialState } from "../game/state";
import { ROSTER_SLOTS, type GameState } from "../game/types";
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
  fireEvent.click(screen.getByRole("button", { name: "Start season 2" }));
  const ready = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(ready.franchise?.year).toBe(2);
  expect(ready.run.result).toBeNull();
  expect(ready.run.playoffs).toBeUndefined();
  expect(ready.run.leagueTeams).toEqual(archived.franchise!.teams);
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
  expect(screen.getByLabelText("Coaching style")).toHaveValue("pace");
  fireEvent.click(screen.getByRole("button", { name: /Simulate season/i }));
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  const skip = screen.queryByRole("button", { name: "Skip reveal" });
  if (skip) fireEvent.click(skip);
  const played = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(played.run.result?.modelVersion).toBe(4);
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
}, 20000);

import { POKEMON_BY_ID } from "../data/pokemon";
const nameOf = (id: number) => POKEMON_BY_ID.get(id)!.name;

it("saves an accepted offseason trade, keeps careers, and restores both rosters", async () => {
  vi.useFakeTimers();
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
  expect(offer).toBeDefined();
  const storage = memory();
  const mounted = render(<App initial={offseason} storage={storage} />);
  fireEvent.change(screen.getByLabelText("Trade partner"), {
    target: { value: String(offer.teamId) },
  });
  fireEvent.change(screen.getByLabelText("Player you send"), {
    target: { value: String(offer.giveId) },
  });
  fireEvent.change(screen.getByLabelText("Player you receive"), {
    target: { value: String(offer.receiveId) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Complete trade" }));
  const traded = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(traded.franchise!.trades).toEqual([{ year: 1, ...offer }]);
  expect(Object.values(traded.franchise!.teams[0].roster)).toContain(
    offer.receiveId,
  );
  expect(Object.values(traded.franchise!.teams[offer.teamId].roster)).toContain(
    offer.giveId,
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
    screen.getByRole("list", { name: "Your offseason roster" }),
  ).toHaveTextContent(nameOf(offer.receiveId));
  fireEvent.click(
    screen.getByRole("button", { name: "End franchise / new draft" }),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    /career stats, trades and championship history/,
  );
  fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
  expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(traded);
}, 20000);

import { enterOffseason, evaluateTrade } from "../game/franchise";

it("moves keyboard focus to the offseason hub after continuation", () => {
  render(<App initial={finished} storage={memory()} />);
  const button = screen.getByRole("button", { name: "Continue as franchise" });
  button.focus();
  fireEvent.click(button);
  expect(
    screen.getByRole("heading", { name: "Build a legacy." }),
  ).toHaveFocus();
});
