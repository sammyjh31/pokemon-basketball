import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StrictMode } from "react";
import App from "../App";
import { createRun } from "../game/draft";
import { initialState } from "../game/state";
import type { GameState } from "../game/types";
import "../test/preloadPanels";
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

it("offers all eight builder pools before choosing a coach", async () => {
  const initial = {
    ...initialState(41),
    run: {
      ...createRun("free", false, 41, "all"),
      coachDraftRequired: true as const,
    },
  };
  let stored: GameState | undefined;
  render(
    <App
      initial={initial}
      storage={{
        getItem: () => null,
        setItem: (_key, raw) => {
          stored = JSON.parse(raw);
        },
      }}
    />,
  );
  const picker = screen.getByRole("combobox", { name: "Lineup generation" });
  expect(picker).toHaveValue("all");
  expect(picker.querySelectorAll("option")).toHaveLength(8);
  fireEvent.change(picker, { target: { value: "7" } });
  await waitFor(() => expect(stored?.run.draftPool).toBe(7));
  expect(
    screen.getByRole("region", { name: "Your team. Their game plan." }),
  ).toBeVisible();
});

it("confirms only destructive builder changes and preserves eligible players and coach", async () => {
  const run = {
    ...createRun("free", false, 41, "all"),
    coach: { version: 1 as const, id: "misty" },
  };
  run.roster = { ...run.roster, PG: 25, SG: 722 };
  let stored: GameState | undefined;
  render(
    <App
      initial={{ ...initialState(41), run }}
      storage={{
        getItem: () => null,
        setItem: (_key, raw) => {
          stored = JSON.parse(raw);
        },
      }}
    />,
  );
  const picker = screen.getByRole("combobox", { name: "Lineup generation" });
  fireEvent.change(picker, { target: { value: "1" } });
  expect(screen.getByRole("dialog")).toHaveTextContent("Rowlet");
  fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
  expect(picker).toHaveValue("all");
  expect(stored!.run.roster).toEqual(run.roster);
  fireEvent.change(picker, { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Change pool" }));
  await waitFor(() => expect(stored?.run.draftPool).toBe(1));
  expect(stored!.run.roster).toEqual({ ...run.roster, SG: null });
  expect(stored!.run.coach).toEqual(run.coach);
  fireEvent.change(picker, { target: { value: "all" } });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(stored?.run.draftPool).toBe("all"));
  expect(stored!.run.roster.PG).toBe(25);
});

it.each([false, true])(
  "imports a specific generation through shared links and retains it on refresh (existing draft: %s)",
  async (existing) => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    if (existing) {
      const state = { ...initialState(4), run: createRun("free", false, 4, 7) };
      state.run.roster.PG = 722;
      storage.setItem("pokemon-basketball:v3", JSON.stringify(state));
    }
    window.history.replaceState(
      null,
      "",
      "/?lineup=25,26,27,28,29&pool=1&keep=1",
    );
    const mounted = render(
      <StrictMode>
        <App storage={storage} />
      </StrictMode>,
    );
    if (existing) {
      expect(
        screen.getByRole("combobox", { name: "Lineup generation" }),
      ).toHaveValue("7");
      fireEvent.click(screen.getByRole("button", { name: "Load lineup" }));
    }
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Lineup generation" }),
      ).toHaveValue("1"),
    );
    expect(
      JSON.parse(storage.getItem("pokemon-basketball:v3")!).run.roster.PG,
    ).toBe(25);
    expect(window.location.search).toBe("?keep=1");
    mounted.unmount();
    render(<App storage={storage} />);
    expect(
      screen.getByRole("combobox", { name: "Lineup generation" }),
    ).toHaveValue("1");
  },
);

it("uses all generations for a new builder and preserves explicit selections across modes", async () => {
  let stored: GameState | undefined;
  render(
    <App
      initial={initialState(4)}
      storage={{
        getItem: () => null,
        setItem: (_key, raw) => {
          stored = JSON.parse(raw);
        },
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Lineup builder" }));
  expect(
    screen.getByRole("combobox", { name: "Lineup generation" }),
  ).toHaveValue("all");
  fireEvent.change(
    screen.getByRole("combobox", { name: "Lineup generation" }),
    { target: { value: "6" } },
  );
  fireEvent.click(
    within(
      screen.getByRole("region", { name: "Your team. Their game plan." }),
    ).getAllByRole("button", { name: /^Draft / })[0],
  );
  fireEvent.click(screen.getByRole("button", { name: "New run" }));
  await waitFor(() => expect(stored?.run.draftPool).toBe(6));
  fireEvent.click(screen.getByRole("button", { name: "82–0 Challenge" }));
  expect(
    screen.getByRole("combobox", { name: "Challenge generation" }),
  ).toHaveValue("6");
});
