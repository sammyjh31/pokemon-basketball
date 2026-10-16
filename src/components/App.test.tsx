import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import App from "../App";
import { initialState, gameReducer } from "../game/state";
import { ROSTER_SLOTS } from "../game/types";
import { STORAGE_KEY, type StorageLike } from "../game/persistence";
import { StrictMode } from "react";
import { simulateSeason as legacySeason } from "../game/legacySeason";
const memory = (): StorageLike => {
  let s: string | null = null;
  return {
    getItem: () => s,
    setItem: (_k, v) => {
      s = v;
    },
  };
};
const fill = () => {
  let state = initialState(31);
  for (const position of ROSTER_SLOTS)
    state = gameReducer(state, {
      type: "PLACE",
      position,
      pokemonId: state.run.offerIds[0],
    });
  return state;
};
const pick = () =>
  fireEvent.click(screen.getAllByRole("button", { name: /^Draft / })[0]);
const slot = (position: string) =>
  screen.getByRole("button", { name: new RegExp(`^${position} slot:`) });
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});
afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("playable draft room", () => {
  it("shows archived five-player recaps without unusable bench controls and protects them from reset", () => {
    const state = initialState(12);
    state.run.roster = {
      PG: 65,
      SG: 135,
      SF: 6,
      PF: 68,
      C: 143,
      B1: null,
      B2: null,
      B3: null,
    };
    state.run.result = { ...legacySeason(state.run), modelVersion: 1 };
    render(<App initial={state} storage={memory()} />);
    expect(screen.getByText("Archived recap")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Bench and coaching" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("season-record")).toHaveTextContent(
      `${state.run.result.wins}–${state.run.result.losses}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "New run" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("confirms resets when only the bench has been drafted", () => {
    const state = gameReducer(initialState(17), {
      type: "NEW_RUN",
      mode: "free",
      includeLegends: true,
      seed: 17,
    });
    render(<App initial={state} storage={memory()} />);
    fireEvent.click(screen.getByRole("button", { name: "Auto-fill bench" }));
    const before = slot("B1").getAttribute("aria-label");
    fireEvent.click(screen.getByRole("button", { name: "New run" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(slot("B1")).toHaveAccessibleName(before!);
  });

  it("randomizes and clears a free lineup without resetting records", () => {
    const state = gameReducer(initialState(17), {
      type: "NEW_RUN",
      mode: "free",
      includeLegends: false,
      seed: 17,
    });
    const storage = memory();
    render(<App initial={state} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Randomize" }));
    expect(
      screen.getByRole("button", { name: "Simulate season" }),
    ).toBeEnabled();
    const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(new Set(Object.values(saved.run.roster)).size).toBe(8);
    expect(
      Object.values(saved.run.roster).some((id) =>
        [144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251].includes(
          id as number,
        ),
      ),
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    for (const position of ROSTER_SLOTS)
      expect(slot(position)).toHaveAccessibleName(`${position} slot: Empty`);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).records).toEqual(
      state.records,
    );
  });
  it("imports a shared lineup once in Strict Mode, then restores edits on refresh", () => {
    window.history.replaceState(null, "", "/?lineup=65,135,6,68,143");
    const storage = memory();
    const mounted = render(
      <StrictMode>
        <App storage={storage} />
      </StrictMode>,
    );
    expect(slot("PG")).toHaveAccessibleName("PG slot: Alakazam");
    expect(slot("C")).toHaveAccessibleName("C slot: Snorlax");
    expect(window.location.search).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    mounted.unmount();
    render(<App storage={storage} />);
    expect(slot("PG")).toHaveAccessibleName("PG slot: Empty");
  });
  it.each([false, true])(
    "asks before importing over a saved run (completed: %s)",
    async (completed) => {
      const state = completed
        ? gameReducer(fill(), { type: "SIMULATE" })
        : fill();
      const storage = memory();
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.history.replaceState(null, "", "/?lineup=65,135,6,68,143");
      const mounted = render(
        <StrictMode>
          <App storage={storage} />
        </StrictMode>,
      );
      expect(
        await screen.findByRole(
          "dialog",
          { name: "Load shared lineup?" },
          { timeout: 10000 },
        ),
      ).toBeInTheDocument();
      expect(JSON.parse(storage.getItem(STORAGE_KEY)!).run).toEqual(state.run);
      fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
      expect(window.location.search).toBe("");
      expect(JSON.parse(storage.getItem(STORAGE_KEY)!).run).toEqual(state.run);
      mounted.unmount();
      window.history.replaceState(null, "", "/?lineup=65,135,6,68,143");
      render(<App storage={storage} />);
      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: "Load lineup" },
          { timeout: 10000 },
        ),
      );
      expect(slot("PG")).toHaveAccessibleName("PG slot: Alakazam");
      expect(JSON.parse(storage.getItem(STORAGE_KEY)!).records).toEqual(
        state.records,
      );
      expect(window.location.search).toBe("");
    },
    20000, // StrictMode restores and validates complete 1,230-game saves.
  );
  it.each(["25", "#25", "025", "#025"])(
    "searches number %s and switches between local sprite styles",
    (query) => {
      const state = gameReducer(initialState(17), {
        type: "NEW_RUN",
        mode: "free",
        includeLegends: true,
        seed: 17,
      });
      render(<App initial={state} storage={memory()} />);
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search Pokémon" }),
        { target: { value: query } },
      );
      expect(
        screen.getByRole("button", { name: "Draft Pikachu" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Pikachu" })).toHaveAttribute(
        "src",
        "/pokemon-pixel/25.png",
      );
      fireEvent.click(screen.getByRole("button", { name: "Artwork" }));
      expect(screen.getByRole("img", { name: "Pikachu" })).toHaveAttribute(
        "src",
        "/pokemon/25.png",
      );
    },
  );
  it("provides a usable lineup URL if clipboard access is denied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<App initial={fill()} storage={memory()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    const field = (await screen.findByRole("textbox", {
      name: "Lineup link",
    })) as HTMLInputElement;
    expect(new URL(field.value).searchParams.get("lineup")).toBe(
      Object.values(fill().run.roster).join(","),
    );
    expect(screen.queryByText("Lineup link copied.")).not.toBeInTheDocument();
  });
  it("clears a manual-copy link after the roster changes", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const state = gameReducer(initialState(17), {
      type: "NEW_RUN",
      mode: "free",
      includeLegends: true,
      seed: 17,
    });
    render(<App initial={state} storage={memory()} />);
    fireEvent.click(screen.getByRole("button", { name: "Randomize" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(
      await screen.findByRole("textbox", { name: "Lineup link" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(
      screen.queryByRole("textbox", { name: "Lineup link" }),
    ).not.toBeInTheDocument();
  });
  it("drafts eight players and simulates exactly one season", async () => {
    render(<App initial={initialState(17)} storage={memory()} />);
    expect(
      screen.getByRole("button", { name: "Simulate season" }),
    ).toBeDisabled();
    for (const p of ROSTER_SLOTS) {
      pick();
      fireEvent.click(slot(p));
    }
    fireEvent.click(screen.getByRole("button", { name: "Simulate season" }));
    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Skip reveal" },
        { timeout: 15000 },
      ),
    );
    expect(screen.getAllByTestId("game-result")).toHaveLength(82);
    expect(
      screen.queryByRole("button", { name: "Simulate season" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Draft / }),
    ).not.toBeInTheDocument();
  }, 20000);
  it("counts two rerolls and clears pending selections", () => {
    render(<App initial={initialState(17)} storage={memory()} />);
    pick();
    expect(screen.getByTestId("placement-preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Re-roll.*2/ }));
    expect(screen.queryByTestId("placement-preview")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Re-roll.*1/ }));
    expect(screen.getByRole("button", { name: /Re-roll.*0/ })).toBeDisabled();
  });
  it("searches, filters, replaces and swaps in free draft", () => {
    const state = gameReducer(initialState(17), {
      type: "NEW_RUN",
      mode: "free",
      includeLegends: true,
      seed: 17,
    });
    render(<App initial={state} storage={memory()} />);
    const search = screen.getByRole("searchbox", { name: "Search Pokémon" });
    fireEvent.change(search, { target: { value: "Pikachu" } });
    expect(screen.getAllByRole("button", { name: /^Draft / })).toHaveLength(1);
    pick();
    fireEvent.click(slot("PG"));
    expect(slot("PG")).toHaveAccessibleName("PG slot: Pikachu");
    fireEvent.change(search, { target: { value: "Snorlax" } });
    pick();
    fireEvent.click(slot("C"));
    fireEvent.click(slot("PG"));
    fireEvent.click(slot("C"));
    expect(slot("PG")).toHaveAccessibleName("PG slot: Snorlax");
    fireEvent.change(search, { target: { value: "Alakazam" } });
    pick();
    fireEvent.click(slot("PG"));
    expect(slot("PG")).toHaveAccessibleName("PG slot: Alakazam");
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filter by type"), {
      target: { value: "fire" },
    });
    expect(
      screen.getByRole("button", { name: "Draft Charmander" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Draft Squirtle" }),
    ).not.toBeInTheDocument();
  });
  it("canceling a mode change preserves the drafted Pokémon", () => {
    render(<App initial={initialState(17)} storage={memory()} />);
    pick();
    fireEvent.click(slot("PG"));
    const name = slot("PG").getAttribute("aria-label");
    fireEvent.click(screen.getByRole("button", { name: "Lineup builder" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Keep playing",
      }),
    );
    expect(slot("PG")).toHaveAttribute("aria-label", name);
    expect(
      screen.getByRole("button", { name: "82–0 Challenge" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
  it("old result timers cannot update a new run", async () => {
    vi.useFakeTimers();
    render(<App initial={fill()} storage={memory()} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulate season" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    fireEvent.click(screen.getByRole("button", { name: "New run" }));
    fireEvent.click(screen.getByRole("button", { name: "Start new run" }));
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.queryAllByTestId("game-result")).toHaveLength(0);
    expect(slot("PG")).toHaveAccessibleName("PG slot: Empty");
  });
  it("shows completed results immediately with reduced motion", async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
    } as MediaQueryList);
    render(<App initial={fill()} storage={memory()} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulate season" }));
    await waitFor(
      () => expect(screen.getAllByTestId("game-result")).toHaveLength(82),
      { timeout: 15000 },
    );
    expect(
      screen.queryByRole("button", { name: "Skip reveal" }),
    ).not.toBeInTheDocument();
  });
  it("keeps portrait failures identifiable", () => {
    render(<App initial={initialState(17)} storage={memory()} />);
    const img = screen.getAllByRole("img")[0];
    const name = img.getAttribute("alt")!;
    fireEvent.error(img);
    expect(
      screen.getByRole("button", { name: `Draft ${name}` }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("portrait-fallback").length).toBeGreaterThan(
      0,
    );
  });
  it("offers selectable recap text when clipboard permission is denied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(
      <App
        initial={gameReducer(fill(), { type: "SIMULATE" })}
        storage={memory()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy recap" }));
    expect(
      (
        (await screen.findByRole("textbox", {
          name: "Season recap",
        })) as HTMLTextAreaElement
      ).value,
    ).toContain("82–0 Pokémon Basketball");
    expect(screen.queryByText("Recap copied!")).not.toBeInTheDocument();
  });
  it("allows play with a storage failure and announces the limitation", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    render(<App initial={initialState(17)} storage={storage} />);
    expect(screen.getByText(/progress will not be saved/)).toBeInTheDocument();
    pick();
    fireEvent.click(slot("PG"));
    expect(slot("PG")).not.toHaveAccessibleName("PG slot: Empty");
  });
  it("restores a completed season and history on refresh", async () => {
    const storage = memory(),
      state = gameReducer(fill(), { type: "SIMULATE" });
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    render(<App storage={storage} />);
    expect(
      await screen.findAllByTestId("game-result", {}, { timeout: 10000 }),
    ).toHaveLength(82);
    expect(screen.getByTestId("season-record")).toHaveTextContent(
      `${state.run.result!.wins}–${state.run.result!.losses}`,
    );
  }, 15000); // Includes a full season simulation and asynchronous replay on refresh.
});

describe("completed league restoration", () => {
  let saved: ReturnType<typeof initialState>;
  beforeAll(() => {
    saved = gameReducer(fill(), { type: "SIMULATE" });
  }, 20000);

  it("paints restoration progress in Strict Mode and preserves original bytes until validation completes", async () => {
    vi.useFakeTimers();
    const storage = memory();
    const source = JSON.stringify(saved, null, 2);
    storage.setItem(STORAGE_KEY, source);
    render(
      <StrictMode>
        <App storage={storage} />
      </StrictMode>,
    );
    expect(
      screen.getByRole("heading", { name: "Restoring your league" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", {
        name: "Saved league restoration progress",
      }),
    ).toHaveAttribute("value", "0");
    expect(storage.getItem(STORAGE_KEY) === source).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Simulate season" }),
    ).not.toBeInTheDocument();
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(
      screen.queryByRole("heading", { name: "Restoring your league" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("season-record")).toHaveTextContent(
      `${saved.run.result!.wins}–${saved.run.result!.losses}`,
    );
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(saved);
  }, 20000);

  it("cancels an unmounted restoration so it cannot overwrite a newer draft", async () => {
    vi.useFakeTimers();
    const storage = memory();
    storage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const mounted = render(
      <StrictMode>
        <App storage={storage} />
      </StrictMode>,
    );
    expect(
      screen.getByRole("heading", { name: "Restoring your league" }),
    ).toBeInTheDocument();
    mounted.unmount();
    const next = initialState(918);
    const source = JSON.stringify(next, null, 2);
    storage.setItem(STORAGE_KEY, source);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(storage.getItem(STORAGE_KEY) === source).toBe(true);
    render(<App storage={storage} />);
    expect(slot("PG")).toHaveAccessibleName("PG slot: Empty");
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).run.id).toBe(next.run.id);
  });

  it("preserves a failed completed save until the user changes the fresh draft", async () => {
    vi.useFakeTimers();
    const storage = memory();
    const invalid = structuredClone(saved);
    invalid.run.result!.wins += 1;
    const source = JSON.stringify(invalid, null, 2);
    storage.setItem(STORAGE_KEY, source);
    render(<App storage={storage} />);
    expect(
      screen.getByRole("heading", { name: "Restoring your league" }),
    ).toBeInTheDocument();
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(
      screen.getByText(/Your saved game could not be restored/),
    ).toBeInTheDocument();
    expect(storage.getItem(STORAGE_KEY) === source).toBe(true);
    expect(slot("PG")).toHaveAccessibleName("PG slot: Empty");
    pick();
    fireEvent.click(slot("PG"));
    expect(storage.getItem(STORAGE_KEY) === source).toBe(false);
    expect(
      screen.queryByText(/The original save is kept until you make a change/),
    ).not.toBeInTheDocument();
  }, 20000);
  it("keeps the source bytes when the completed save fails validation before replay", () => {
    const storage = memory();
    const invalid = structuredClone(saved);
    invalid.run.seasonSeed = -1;
    const source = JSON.stringify(invalid, null, 2);
    storage.setItem(STORAGE_KEY, source);
    render(<App storage={storage} />);
    expect(
      screen.getByText(/Your saved game could not be restored/),
    ).toBeInTheDocument();
    expect(storage.getItem(STORAGE_KEY) === source).toBe(true);
  });
});

it("persists a shared lineup replacing malformed storage through simulation and refresh", async () => {
  vi.useFakeTimers();
  const storage = memory();
  storage.setItem(STORAGE_KEY, "{malformed");
  window.history.replaceState(null, "", "/?lineup=65,135,6,68,143,121,131,149");
  const mounted = render(
    <StrictMode>
      <App storage={storage} />
    </StrictMode>,
  );
  expect(slot("PG")).toHaveAccessibleName("PG slot: Alakazam");
  expect(window.location.search).toBe("");
  expect(storage.getItem(STORAGE_KEY)).not.toBe("{malformed");
  expect(
    screen.queryByText(/The original save is kept until you make a change/),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Simulate season" }));
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
  expect(saved.run.result.modelVersion).toBe(3);
  expect(saved.records.free.runs).toBe(1);
  mounted.unmount();
  render(<App storage={storage} />);
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(slot("PG")).toHaveAccessibleName("PG slot: Alakazam");
  expect(screen.getByTestId("season-record")).toHaveTextContent(
    `${saved.run.result.wins}–${saved.run.result.losses}`,
  );
  expect(JSON.parse(storage.getItem(STORAGE_KEY)!).records.free.runs).toBe(1);
}, 20000);
