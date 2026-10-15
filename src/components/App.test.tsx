import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { initialState, gameReducer } from "../game/state";
import { POSITIONS } from "../game/types";
import { STORAGE_KEY, type StorageLike } from "../game/persistence";
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
  for (const position of POSITIONS)
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
    value: vi
      .fn()
      .mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("playable draft room", () => {
  it("drafts five starters and simulates exactly one season", () => {
    render(<App initial={initialState(17)} storage={memory()} />);
    expect(
      screen.getByRole("button", { name: "Simulate season" }),
    ).toBeDisabled();
    for (const p of POSITIONS) {
      pick();
      fireEvent.click(slot(p));
    }
    fireEvent.click(screen.getByRole("button", { name: "Simulate season" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip reveal" }));
    expect(screen.getAllByTestId("game-result")).toHaveLength(82);
    expect(
      screen.queryByRole("button", { name: "Simulate season" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Draft / }),
    ).not.toBeInTheDocument();
  });
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
    fireEvent.click(screen.getByRole("button", { name: "Free Draft" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Keep playing",
      }),
    );
    expect(slot("PG")).toHaveAttribute("aria-label", name);
    expect(screen.getByRole("button", { name: "Spin & Pick" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("old result timers cannot update a new run", () => {
    vi.useFakeTimers();
    render(<App initial={fill()} storage={memory()} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulate season" }));
    act(() => vi.advanceTimersByTime(200));
    fireEvent.click(screen.getByRole("button", { name: "New run" }));
    fireEvent.click(screen.getByRole("button", { name: "Start new run" }));
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.queryAllByTestId("game-result")).toHaveLength(0);
    expect(slot("PG")).toHaveAccessibleName("PG slot: Empty");
  });
  it("shows completed results immediately with reduced motion", () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
    } as MediaQueryList);
    render(<App initial={fill()} storage={memory()} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulate season" }));
    expect(screen.getAllByTestId("game-result")).toHaveLength(82);
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
  it("restores a completed season and history on refresh", () => {
    const storage = memory(),
      state = gameReducer(fill(), { type: "SIMULATE" });
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    render(<App storage={storage} />);
    expect(screen.getAllByTestId("game-result")).toHaveLength(82);
    expect(screen.getByTestId("season-record")).toHaveTextContent(
      `${state.run.result!.wins}–${state.run.result!.losses}`,
    );
  });
});
