import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { useLocalLeague } from "./useLocalLeague";
import { LocalLeagueMode } from "../components/LocalLeagueMode";
import {
  advanceLocalCpu,
  createLocalLeague,
  currentLocalTurn,
  localLeaguePool,
  parseLocalLeague,
  pickLocalPlayer,
} from "../game/localLeague";
import {
  beginLocalOffseason,
  localSeasonSeed,
  startNextLocalSeason,
} from "../game/localCareer";
import { simulateLocalSeason } from "../game/localSeason";
import { playoffGameCount, simulatePlayoffs } from "../game/playoffs";
import { ROSTER_SLOTS } from "../game/types";
import type { LocalRestoreMessage } from "../game/localLeagueRestore";

// The browser boundary can pause delivery; validation itself remains the real parser.
class ControlledWorker {
  static jobs: ControlledWorker[] = [];
  onmessage: ((event: MessageEvent<LocalRestoreMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  raw = "";
  terminated = false;
  constructor() {
    ControlledWorker.jobs.push(this);
  }
  postMessage(raw: string) {
    this.raw = raw;
  }
  terminate() {
    this.terminated = true;
  }
  verify() {
    const send = (data: LocalRestoreMessage) =>
      this.onmessage?.({ data } as MessageEvent<LocalRestoreMessage>);
    try {
      const draft = advanceLocalCpu(
        parseLocalLeague(this.raw, (completed, total) =>
          send({ type: "progress", completed, total }),
        ),
      );
      send({ type: "complete", draft });
    } catch (error) {
      send({ type: "error", message: (error as Error).message });
    }
  }
}
let raw: string;
beforeAll(() => {
  let draft = createLocalLeague(
    [
      { name: "Sam", teamId: 0 },
      { name: "Alex", teamId: 1 },
    ],
    false,
    19,
    2,
    {
      mode: "full-pool",
      format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
      engineRules: {
        version: 1,
        abilities: true,
        adaptiveCoaching: false,
        familiarity: 0,
      },
    },
  );
  while (currentLocalTurn(draft)) {
    draft = advanceLocalCpu(draft);
    const turn = currentLocalTurn(draft);
    if (!turn) break;
    const mon = localLeaguePool(draft).find(
      (mon) => !draft.picks.some((pick) => pick.pokemonId === mon.id),
    )!;
    const slot = ROSTER_SLOTS.find(
      (slot) =>
        !draft.picks.some(
          (pick) => pick.teamId === turn.teamId && pick.slot === slot,
        ),
    )!;
    draft = pickLocalPlayer(draft, mon.id, slot);
  }
  const result = simulateLocalSeason(draft);
  const playoffs = simulatePlayoffs(result.league!, localSeasonSeed(draft));
  const completed = {
    ...draft,
    completed: true,
    playoffGames: playoffGameCount(playoffs),
  };
  raw = JSON.stringify(
    startNextLocalSeason(beginLocalOffseason(completed, result, playoffs)),
    null,
    2,
  );
}, 60000);
beforeEach(() => {
  ControlledWorker.jobs = [];
  vi.stubGlobal("Worker", ControlledWorker);
});
afterEach(() => vi.unstubAllGlobals());
function memory(source = raw) {
  let value = source;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

it("paints before career verification and preserves the original bytes until the real parser succeeds", async () => {
  const storage = memory();
  const view = renderHook(() => useLocalLeague(storage));
  expect(view.result.current.restoration?.status).toBe("loading");
  expect(view.result.current.draft).toBeNull();
  expect(storage.getItem()).toBe(raw);
  const worker = ControlledWorker.jobs[0];
  expect(worker.raw).toBe(raw);
  await act(async () => worker.verify());
  expect(view.result.current.restoration).toBeNull();
  expect(view.result.current.draft?.career?.year).toBe(2);
  expect(JSON.parse(storage.getItem()).career).toEqual(JSON.parse(raw).career);
  expect(worker.terminated).toBe(true);
});

it("cancels without losing the save, ignores late worker delivery, and can retry", async () => {
  const storage = memory();
  const view = renderHook(() => useLocalLeague(storage));
  const worker = ControlledWorker.jobs[0];
  const late = worker.onmessage!;
  act(() => view.result.current.cancelRestore());
  expect(view.result.current.restoration?.status).toBe("cancelled");
  expect(worker.terminated).toBe(true);
  act(() =>
    late({
      data: { type: "complete", draft: JSON.parse(raw) },
    } as MessageEvent<LocalRestoreMessage>),
  );
  expect(view.result.current.draft).toBeNull();
  expect(storage.getItem()).toBe(raw);
  act(() => view.result.current.retryRestore());
  expect(view.result.current.restoration?.status).toBe("loading");
  expect(ControlledWorker.jobs).toHaveLength(2);
  view.unmount();
  expect(ControlledWorker.jobs[1].terminated).toBe(true);
  expect(storage.getItem()).toBe(raw);
});

it("shows progress and recovery without exposing a new draft until explicitly confirmed", async () => {
  const storage = memory();
  render(<LocalLeagueMode storage={storage} onExit={() => {}} />);
  expect(
    screen.getByRole("heading", { name: "Restoring your local league" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Start snake draft" }),
  ).not.toBeInTheDocument();
  act(() =>
    ControlledWorker.jobs[0].onmessage?.({
      data: { type: "progress", completed: 1, total: 3 },
    } as MessageEvent<LocalRestoreMessage>),
  );
  expect(
    screen.getByRole("progressbar", {
      name: "Local career verification progress",
    }),
  ).toHaveAttribute("value", "1");
  fireEvent.click(screen.getByRole("button", { name: "Cancel restore" }));
  expect(storage.getItem()).toBe(raw);
  fireEvent.click(
    screen.getByRole("button", { name: "Start a new local league" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
  expect(storage.getItem()).toBe(raw);
  fireEvent.click(
    screen.getByRole("button", { name: "Start a new local league" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Replace local league" }));
  expect(
    screen.getByRole("button", { name: "Start snake draft" }),
  ).toBeInTheDocument();
  expect(storage.getItem()).toBe("");
});

it("keeps the original save if the browser cannot start background verification", async () => {
  vi.stubGlobal("Worker", undefined);
  const storage = memory();
  const view = renderHook(() => useLocalLeague(storage));
  await waitFor(() =>
    expect(view.result.current.restoration?.status).toBe("error"),
  );
  expect(view.result.current.draft).toBeNull();
  expect(storage.getItem()).toBe(raw);
});

it("keeps a rejected career untouched after the worker verifies its archived provenance", async () => {
  const corrupt = JSON.parse(raw);
  const bonds = corrupt.career.teams[0].chemistryBonds;
  bonds[Object.keys(bonds)[0]] += 1;
  const source = JSON.stringify(corrupt, null, 2);
  const storage = memory(source);
  const view = renderHook(() => useLocalLeague(storage));
  await act(async () => ControlledWorker.jobs[0].verify());
  expect(view.result.current.restoration?.status).toBe("error");
  expect(view.result.current.error).toMatch(/original saved data is unchanged/);
  expect(view.result.current.draft).toBeNull();
  expect(storage.getItem()).toBe(source);
});
