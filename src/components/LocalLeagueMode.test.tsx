import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocalLeagueMode } from "./LocalLeagueMode";
import App from "../App";
import {
  LOCAL_LEAGUE_KEY,
  advanceLocalCpu,
  createLocalLeague,
  currentLocalTurn,
  parseLocalLeague,
  pickLocalPlayer,
} from "../game/localLeague";
import { POKEMON } from "../data/pokemon";
import { ROSTER_SLOTS } from "../game/types";
import type { StorageLike } from "../game/persistence";
import { initialState } from "../game/state";
import { LOCAL_DEFAULT_OPTIONS } from "../game/localFormat";

function memory(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
function completeDraft(version: 1 | 2 = 2) {
  let draft = advanceLocalCpu(
    createLocalLeague(
      [
        { name: "Sam", teamId: 0 },
        { name: "Alex", teamId: 1 },
      ],
      false,
      42,
      version,
    ),
  );
  while (currentLocalTurn(draft)) {
    const teamId = currentLocalTurn(draft)!.teamId;
    const mon = POKEMON.find(
      (m) => !m.legendary && !draft.picks.some((p) => p.pokemonId === m.id),
    )!;
    const slot = ROSTER_SLOTS.find(
      (s) => !draft.picks.some((p) => p.teamId === teamId && p.slot === s),
    )!;
    draft = advanceLocalCpu(pickLocalPlayer(draft, mon.id, slot));
  }
  return draft;
}

describe("local league pass-and-play", () => {
  it("shows unit chemistry for current leagues and preserves the historical passing-bonus explanation", () => {
    const draft = {
      ...completeDraft(),
      options: {
        ...LOCAL_DEFAULT_OPTIONS,
        mode: "full-pool" as const,
        format: { ...LOCAL_DEFAULT_OPTIONS.format, teamCount: 30 as const },
      },
    };
    const legacy = {
      ...draft,
      chemistryVersion: undefined,
      chemistryGrowthVersion: undefined,
    };
    const view = render(
      <LocalLeagueMode
        onExit={() => {}}
        storage={memory({ [LOCAL_LEAGUE_KEY]: JSON.stringify(legacy) })}
      />,
    );
    expect(
      screen.getByText(/percentage points on passing plays/),
    ).toBeInTheDocument();
    view.unmount();
    render(
      <LocalLeagueMode
        onExit={() => {}}
        storage={memory({
          [LOCAL_LEAGUE_KEY]: JSON.stringify({ ...draft, chemistryVersion: 1 }),
        })}
      />,
    );
    expect(
      screen.queryByText(/percentage points on passing plays/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Projected five-player chemistry" }),
    ).toHaveTextContent("Cohesion");
  });
  it("sets up friends, confirms a human pick, then resumes the next turn from its own save", async () => {
    const storage = memory({ "pokemon-basketball:v3": "existing franchise" });
    const view = render(
      <LocalLeagueMode onExit={() => {}} storage={storage} />,
    );
    fireEvent.change(screen.getByLabelText("Friend 1 name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByLabelText("Friend 2 name"), {
      target: { value: "Alex" },
    });
    fireEvent.change(screen.getByLabelText("Franchise progression"), {
      target: { value: "full-pool" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start snake draft" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Draft Delia Ketchum (Mom)" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Draft Ash Ketchum" }));
    expect(
      screen.getByRole("heading", { name: /On the clock/ }),
    ).toBeInTheDocument();
    const before = parseLocalLeague(storage.data.get(LOCAL_LEAGUE_KEY)!);
    fireEvent.change(screen.getByLabelText("Filter by generation"), {
      target: { value: "7" },
    });
    fireEvent.click(
      (
        await screen.findAllByRole(
          "button",
          { name: /^View scouting for / },
          { timeout: 10000 },
        )
      )[0],
    );
    const confirmPick = screen.getByRole("button", { name: /^Confirm pick/ });
    confirmPick.focus();
    fireEvent.click(confirmPick);
    expect(screen.getByRole("heading", { name: /On the clock/ })).toHaveFocus();
    const after = parseLocalLeague(storage.data.get(LOCAL_LEAGUE_KEY)!);
    expect(after.picks.length).toBeGreaterThan(before.picks.length);
    expect(after.picks[before.picks.length].teamId).toBe(
      currentLocalTurn(before)!.teamId,
    );
    expect(after.picks[before.picks.length].pokemonId).toBeGreaterThan(721);
    expect(storage.data.get("pokemon-basketball:v3")).toBe(
      "existing franchise",
    );
    view.unmount();
    render(<LocalLeagueMode onExit={() => {}} storage={storage} />);
    expect(
      screen.getByRole("heading", { name: /On the clock/ }),
    ).toHaveTextContent(currentLocalTurn(after)!.manager!.name);
    fireEvent.click(screen.getByRole("button", { name: "New local league" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(parseLocalLeague(storage.data.get(LOCAL_LEAGUE_KEY)!).picks).toEqual(
      after.picks,
    );
  });

  it("preserves malformed save bytes and reports failed storage without stopping play", () => {
    const storage = memory({ [LOCAL_LEAGUE_KEY]: "broken saved draft" });
    const view = render(
      <LocalLeagueMode onExit={() => {}} storage={storage} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /saved local league.*could not be loaded/i,
    );
    expect(storage.data.get(LOCAL_LEAGUE_KEY)).toBe("broken saved draft");
    view.unmount();
    const blocked: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    render(<LocalLeagueMode onExit={() => {}} storage={blocked} />);
    fireEvent.click(screen.getByRole("button", { name: "Start snake draft" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Draft Delia Ketchum (Mom)" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Draft Ash Ketchum" }));
    expect(
      screen.getByText(/could not save this local league/i),
    ).toHaveAttribute("role", "status");
    expect(
      screen.getByRole("heading", { name: /On the clock/ }),
    ).toBeInTheDocument();
  });

  it("simulates the season and playoffs, restoring the same bracket and champion without rerolling", async () => {
    const storage = memory({
      [LOCAL_LEAGUE_KEY]: JSON.stringify(completeDraft()),
    });
    const view = render(
      <LocalLeagueMode onExit={() => {}} storage={storage} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate local season" }),
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole("table", { name: "Friends leaderboard" }),
        ).toBeInTheDocument(),
      { timeout: 20000 },
    );
    const table = screen.getByRole("table", { name: "Friends leaderboard" });
    expect(within(table).getByText("Sam")).toBeInTheDocument();
    expect(within(table).getByText("Alex")).toBeInTheDocument();
    const records = table.textContent;
    expect(
      parseLocalLeague(storage.data.get(LOCAL_LEAGUE_KEY)!).completed,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Play next slate" }));
    expect(
      screen.getByRole("button", { name: "Finish playoffs" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "New local league" }),
    ).toBeDisabled();
    await waitFor(
      () =>
        expect(
          JSON.parse(storage.data.get(LOCAL_LEAGUE_KEY)!).playoffGames,
        ).toBe(8),
      { timeout: 10000 },
    );
    view.unmount();
    const restored = render(
      <LocalLeagueMode onExit={() => {}} storage={storage} />,
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole("table", { name: "Friends leaderboard" }),
        ).toHaveTextContent(records!),
      { timeout: 20000 },
    );
    expect(screen.getByText(/8 playoff games played/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finish round" }));
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "Finish round" }),
        ).toBeEnabled(),
      { timeout: 10000 },
    );
    const firstRound = JSON.parse(
      storage.data.get(LOCAL_LEAGUE_KEY)!,
    ).playoffGames;
    expect(firstRound).toBeGreaterThanOrEqual(32);
    expect(firstRound).toBeLessThanOrEqual(56);
    fireEvent.click(screen.getByRole("button", { name: "Finish playoffs" }));
    await waitFor(
      () =>
        expect(
          screen.getByRole("article", { name: "Playoff champion" }),
        ).toBeInTheDocument(),
      { timeout: 10000 },
    );
    const champion = screen.getByRole("article", {
      name: "Playoff champion",
    }).textContent;
    const mvp = screen.getByRole("article", { name: "Finals MVP" }).textContent;
    expect(
      screen.getByRole("button", { name: "Finish playoffs" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("table", { name: "Friends leaderboard" }),
    ).toHaveTextContent(records!);
    restored.unmount();
    render(<LocalLeagueMode onExit={() => {}} storage={storage} />);
    await waitFor(
      () =>
        expect(
          screen.getByRole("article", { name: "Playoff champion" }),
        ).toHaveTextContent(champion!),
      { timeout: 20000 },
    );
    expect(
      screen.getByRole("article", { name: "Finals MVP" }),
    ).toHaveTextContent(mvp!);
    fireEvent.click(screen.getByRole("button", { name: "New local league" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Replace local league" }),
    );
    expect(
      screen.getByRole("button", { name: "Start snake draft" }),
    ).toBeInTheDocument();
    expect(storage.data.get(LOCAL_LEAGUE_KEY)).toBe("");
  }, 90000); // Simulates a full court-model season and restores it twice.

  it("opens from the game and returns without replacing the original lineup", async () => {
    window.history.replaceState(null, "", "/");
    const state = initialState(42);
    const storage = memory();
    render(<App initial={state} storage={storage} />);
    const original = storage.data.get("pokemon-basketball:v3");
    fireEvent.click(screen.getByRole("button", { name: "Local league" }));
    expect(
      screen.getByRole("button", { name: "Start snake draft" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to game" }));
    expect(
      screen.getByRole("button", { name: "82–0 Challenge" }),
    ).toBeInTheDocument();
    expect(storage.data.get("pokemon-basketball:v3")).toBe(original);
    window.history.replaceState(null, "", "/");
  });

  it("adds playoffs to an older completed save and keeps an interrupted action pending", async () => {
    const storage = memory({
      [LOCAL_LEAGUE_KEY]: JSON.stringify({
        ...completeDraft(1),
        completed: true,
      }),
    });
    const view = render(
      <LocalLeagueMode onExit={() => {}} storage={storage} />,
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "Play next slate" }),
        ).toBeEnabled(),
      { timeout: 20000 },
    );
    const saved = storage.data.get(LOCAL_LEAGUE_KEY);
    fireEvent.click(screen.getByRole("button", { name: "Finish playoffs" }));
    view.unmount();
    render(<LocalLeagueMode onExit={() => {}} storage={storage} />);
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "Play next slate" }),
        ).toBeEnabled(),
      { timeout: 20000 },
    );
    expect(screen.getByText(/0 playoff games played/)).toBeInTheDocument();
    expect(storage.data.get(LOCAL_LEAGUE_KEY)).toBe(saved);
    expect(
      screen.queryByRole("article", { name: "Playoff champion" }),
    ).not.toBeInTheDocument();
  }, 45000);

  it("does not rewrite a saved playoff prefix that extends beyond the championship", async () => {
    const raw = JSON.stringify(
      { ...completeDraft(), completed: true, playoffGames: 105 },
      null,
      2,
    );
    const storage = memory({ [LOCAL_LEAGUE_KEY]: raw });
    render(<LocalLeagueMode onExit={() => {}} storage={storage} />);
    await waitFor(
      () =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "continue after the championship",
        ),
      { timeout: 60000 },
    );
    expect(storage.data.get(LOCAL_LEAGUE_KEY)).toBe(raw);
    expect(
      screen.queryByRole("button", { name: "Finish playoffs" }),
    ).not.toBeInTheDocument();
  }, 90000);
});
