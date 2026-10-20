import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import App from "../App";
import { createRun, placePokemon } from "../game/draft";
import { initialState } from "../game/state";
import type { GameState } from "../game/types";
import "../test/preloadPanels";
afterEach(cleanup);

it("keeps a saved draft that appears during loading instead of applying fresh-game defaults", () => {
  const run = createRun("spin", false, 22, 7);
  const saved = {
    ...initialState(22),
    run: placePokemon(run, run.offerIds[0], "PG"),
  };
  let reads = 0;
  localStorage.setItem(
    "pokemon-basketball:onboarding:v1",
    JSON.stringify({ style: "skipped", checklistDone: true }),
  );
  render(
    <App
      storage={{
        getItem: () => (++reads <= 3 ? null : JSON.stringify(saved)),
        setItem: () => {},
      }}
    />,
  );
  expect(
    screen.getByRole("combobox", { name: "Challenge generation" }),
  ).toHaveValue("7");
  localStorage.removeItem("pokemon-basketball:onboarding:v1");
});

it("chooses a generation before drafting a coach", async () => {
  const state = initialState(22);
  state.run.coachDraftRequired = true;
  let stored: GameState | undefined;
  render(
    <App
      initial={state}
      storage={{
        getItem: () => null,
        setItem: (_key, raw) => {
          stored = JSON.parse(raw);
        },
      }}
    />,
  );
  const picker = screen.getByRole("combobox", { name: "Challenge generation" });
  expect(
    screen.getByRole("region", { name: "Your team. Their game plan." }),
  ).toBeVisible();
  fireEvent.change(picker, { target: { value: "7" } });
  await waitFor(() => expect(stored?.run.draftPool).toBe(7));
  expect(stored!.run.offerIds.every((id) => id >= 722 && id <= 809)).toBe(true);
  expect(
    screen.getByRole("region", { name: "Your team. Their game plan." }),
  ).toBeVisible();
});

it("confirms generation changes after picks, preserves cancellation and keeps the coach on restart", async () => {
  const run = createRun("spin", false, 22, 7);
  const state = {
    ...initialState(22),
    run: {
      ...placePokemon(run, run.offerIds[0], "PG"),
      coach: { version: 1 as const, id: "misty" },
    },
  };
  let stored: GameState | undefined;
  render(
    <App
      initial={state}
      storage={{
        getItem: () => null,
        setItem: (_key, raw) => {
          stored = JSON.parse(raw);
        },
      }}
    />,
  );
  const picker = screen.getByRole("combobox", { name: "Challenge generation" });
  fireEvent.change(picker, { target: { value: "3" } });
  expect(screen.getByRole("dialog")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
  expect(picker).toHaveValue("7");
  expect(
    screen.getByRole("button", { name: /^PG slot:/ }),
  ).not.toHaveAccessibleName("PG slot: Empty");
  fireEvent.change(picker, { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Restart draft" }));
  await waitFor(() => expect(stored?.run.draftPool).toBe(3));
  expect(stored!.run.coach).toEqual(state.run.coach);
  expect(stored!.run.roster.PG).toBeNull();
  expect(stored!.run.offerIds.every((id) => id >= 252 && id <= 386)).toBe(true);
  expect(
    within(
      screen.getByRole("region", { name: "Your starting lineup" }),
    ).getByText(/Generation III · Hoenn/),
  ).toBeVisible();
});
