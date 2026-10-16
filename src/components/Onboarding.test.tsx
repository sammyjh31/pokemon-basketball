import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import App from "../App";
import { gameReducer, initialState } from "../game/state";
import { STORAGE_KEY, type StorageLike } from "../game/persistence";
import { ROSTER_SLOTS } from "../game/types";
import { ONBOARDING_KEY } from "./onboarding";
import { ConfirmDialog } from "./ConfirmDialog";
import "../test/preloadPanels";

const memory = (): StorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
};
const slot = (position: string) =>
  screen.getByRole("button", { name: new RegExp(`^${position} slot:`) });
const prefs = () => JSON.parse(window.localStorage.getItem(ONBOARDING_KEY)!);

beforeEach(() => {
  window.localStorage.removeItem(ONBOARDING_KEY);
});

it("asks new players how they want to play once, and can be reopened", () => {
  const first = render(<App storage={memory()} />);
  const chooser = screen.getByRole("dialog", {
    name: "How do you want to play?",
  });
  expect(within(chooser).getAllByRole("button")).toHaveLength(5);
  expect(within(chooser).getByText(/After a season/)).toBeInTheDocument();
  fireEvent.click(within(chooser).getByRole("button", { name: /^Free build/ }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  // A fresh run switches without a confirmation: there is nothing to lose.
  expect(
    screen.getByRole("button", { name: "Lineup builder", pressed: true }),
  ).toBeInTheDocument();
  expect(prefs().style).toBe("free");
  first.unmount();

  render(<App storage={memory()} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "How to play" }));
  const reopened = screen.getByRole("dialog", {
    name: "How do you want to play?",
  });
  expect(
    within(reopened).getByRole("button", { name: /^Free build/ }),
  ).toHaveAttribute("aria-current", "true");
  fireEvent.keyDown(reopened, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("remembers a dismissed chooser and never shows it over saved progress", () => {
  const first = render(<App storage={memory()} />);
  fireEvent.click(screen.getByRole("button", { name: "Decide later" }));
  expect(prefs().style).toBe("skipped");
  first.unmount();
  render(<App storage={memory()} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  window.localStorage.removeItem(ONBOARDING_KEY);
  const storage = memory();
  let state = initialState(4);
  state = gameReducer(state, {
    type: "PLACE",
    position: "PG",
    pokemonId: state.run.offerIds[0],
  });
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  render(<App storage={storage} />);
  expect(
    screen.queryByRole("dialog", { name: "How do you want to play?" }),
  ).not.toBeInTheDocument();
});

it("tracks the three-step checklist until it is complete", () => {
  window.localStorage.setItem(
    ONBOARDING_KEY,
    JSON.stringify({ style: "free" }),
  );
  let state = initialState(31);
  for (const position of ROSTER_SLOTS)
    state = gameReducer(state, {
      type: "PLACE",
      position,
      pokemonId: state.run.offerIds[0],
    });
  render(<App initial={state} storage={memory()} />);
  const checklist = screen.getByRole("region", { name: /GETTING STARTED/ });
  expect(checklist).toHaveTextContent("1 of 3 done");
  expect(within(checklist).getByText("Draft 8 Pokémon")).toBeInTheDocument();
  expect(
    within(checklist).getByRole("link", { name: "Simulate the season" }),
  ).toHaveAttribute("href", "#season");
  fireEvent.click(
    within(checklist).getByRole("button", { name: "Hide checklist" }),
  );
  expect(
    screen.queryByRole("region", { name: /GETTING STARTED/ }),
  ).not.toBeInTheDocument();
  expect(prefs().checklistDone).toBe(true);
});

it("names what a mode switch clears", () => {
  let state = initialState(17);
  state = gameReducer(state, {
    type: "PLACE",
    position: "PG",
    pokemonId: state.run.offerIds[0],
  });
  render(<App initial={state} storage={memory()} />);
  fireEvent.click(screen.getByRole("button", { name: "Lineup builder" }));
  const dialog = screen.getByRole("dialog", {
    name: "Switch to Lineup builder?",
  });
  expect(dialog).toHaveAccessibleDescription(
    /Your current lineup will be cleared/,
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Switch to Lineup builder" }),
  );
  expect(
    screen.getByRole("button", { name: "Lineup builder", pressed: true }),
  ).toBeInTheDocument();
  expect(slot("PG")).toHaveAccessibleName("PG slot: Empty");
});

it("changes the Lineup builder legendary pool without clearing other picks", () => {
  let state = gameReducer(initialState(17), {
    type: "NEW_RUN",
    mode: "free",
    includeLegends: true,
    seed: 17,
  });
  state = gameReducer(state, { type: "PLACE", pokemonId: 150, position: "PG" });
  state = gameReducer(state, { type: "PLACE", pokemonId: 143, position: "C" });
  render(<App initial={state} storage={memory()} />);
  const toggle = screen.getByRole("checkbox", {
    name: "Include legendary Pokémon",
  });
  expect(toggle).toHaveAccessibleDescription(
    "Changes the pool. Your other picks stay.",
  );
  fireEvent.click(toggle);
  const dialog = screen.getByRole("dialog", {
    name: "Remove legendary Pokémon?",
  });
  expect(dialog).toHaveAccessibleDescription(/Mewtwo leaves your lineup/);
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Remove legendaries" }),
  );
  expect(slot("PG")).toHaveAccessibleName("PG slot: Empty");
  expect(slot("C")).toHaveAccessibleName("C slot: Snorlax");
  expect(toggle).not.toBeChecked();
  // Adding legends back never removes anyone, so it needs no confirmation.
  fireEvent.click(toggle);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(toggle).toBeChecked();
  expect(slot("C")).toHaveAccessibleName("C slot: Snorlax");
});

it("restarts the 82–0 Challenge draft only after explaining the fixed pool", () => {
  let state = initialState(17);
  state = gameReducer(state, {
    type: "PLACE",
    position: "PG",
    pokemonId: state.run.offerIds[0],
  });
  render(<App initial={state} storage={memory()} />);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Include legendary Pokémon" }),
  );
  const dialog = screen.getByRole("dialog", {
    name: "Remove legendary Pokémon from the pool?",
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep playing" }));
  expect(slot("PG")).not.toHaveAccessibleName("PG slot: Empty");
});

it("gives each dialog its own title and description ids", () => {
  render(
    <>
      <ConfirmDialog title="First" onCancel={() => {}} onConfirm={() => {}} />
      <ConfirmDialog title="Second" onCancel={() => {}} onConfirm={() => {}} />
    </>,
  );
  expect(screen.getByRole("dialog", { name: "First" })).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Second" })).toBeInTheDocument();
  const ids = [...document.querySelectorAll("[role=dialog] h2")].map(
    (node) => node.id,
  );
  expect(new Set(ids).size).toBe(2);
});

it("opens the scouting guide as a dialog and skips to the main content", () => {
  render(<App initial={initialState(3)} storage={memory()} />);
  expect(
    screen.getByRole("link", { name: "Skip to main content" }),
  ).toHaveAttribute("href", "#main-content");
  expect(document.getElementById("main-content")?.tagName).toBe("MAIN");
  const pageLinks = screen.getByRole("navigation", { name: "On this page" });
  fireEvent.click(
    within(pageLinks).getByRole("button", { name: "Scouting guide" }),
  );
  const guide = screen.getByRole("dialog", {
    name: "Basketball brains. Pokémon stats.",
  });
  fireEvent.click(within(guide).getByRole("button", { name: "Close guide" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    within(screen.getByRole("navigation", { name: "Game modes" })).queryByRole(
      "link",
    ),
  ).not.toBeInTheDocument();
});
