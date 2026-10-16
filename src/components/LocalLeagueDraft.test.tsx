import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createLocalLeague, type LocalLeague } from "../game/localLeague";
import { LOCAL_DEFAULT_OPTIONS } from "../game/localFormat";
import { LocalLeagueDraft } from "./LocalLeagueDraft";

function draft(): LocalLeague {
  return {
    ...createLocalLeague(
      [
        { name: "Sam", teamId: 0 },
        { name: "Alex", teamId: 1 },
      ],
      false,
      42,
      2,
      LOCAL_DEFAULT_OPTIONS,
    ),
    order: [0, 1, 2, 3, 4, 5, 6, 7],
  };
}
function search(value: string) {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
}

describe("local draft scouting board", () => {
  it("ranks the whole pool by team impact and shares the criteria with comparison and scouting", () => {
    const state = draft();
    state.picks = [
      { teamId: 0, pokemonId: 65, slot: "PG" },
      { teamId: 0, pokemonId: 135, slot: "SG" },
      { teamId: 1, pokemonId: 143, slot: "C" },
    ];
    state.order = [2, 3, 1, 0, 4, 5, 6, 7];
    const before = JSON.stringify(state);
    const onPick = vi.fn();
    render(<LocalLeagueDraft draft={state} onPick={onPick} />);
    expect(
      screen.getByRole("combobox", { name: "Rank players by" }),
    ).toHaveValue("impact");
    const controls = screen.getByRole("region", {
      name: "Team impact ranking",
    });
    fireEvent.change(
      within(controls).getByRole("combobox", { name: "Rank for position" }),
      { target: { value: "B1" } },
    );
    fireEvent.change(
      within(controls).getByRole("combobox", { name: "Ranking priority" }),
      { target: { value: "rebounding" } },
    );
    const card = screen.getByRole("article", { name: "Rhydon draft prospect" });
    expect(card).toHaveTextContent("+6.0");
    const rank = within(card).getByText(/^Rank \d/).textContent;
    search("Rhydon");
    expect(
      within(
        screen.getByRole("article", { name: "Rhydon draft prospect" }),
      ).getByText(/^Rank \d/).textContent,
    ).toBe(rank);
    fireEvent.click(screen.getByRole("button", { name: "Compare Rhydon" }));
    search("Pikachu");
    fireEvent.click(screen.getByRole("button", { name: "Compare Pikachu" }));
    fireEvent.click(screen.getByRole("button", { name: "Compare shortlist" }));
    const comparison = screen.getByRole("region", {
      name: "Compare team impact",
    });
    expect(
      within(comparison).getByRole("combobox", {
        name: "Preview draft position",
      }),
    ).toHaveValue("B1");
    expect(
      within(comparison).getByRole("combobox", { name: "Prioritize" }),
    ).toHaveValue("rebounding");
    expect(within(comparison).getByRole("status")).toHaveTextContent("Rhydon");
    fireEvent.change(
      within(comparison).getByRole("combobox", { name: "Prioritize" }),
      { target: { value: "spacing" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide comparison" }));
    expect(
      within(controls).getByRole("combobox", { name: "Ranking priority" }),
    ).toHaveValue("spacing");
    search("Rhydon");
    expect(
      screen.getByRole("article", { name: "Rhydon draft prospect" }),
    ).toHaveTextContent("−10.6");
    fireEvent.click(
      screen.getByRole("button", { name: "View scouting for Rhydon" }),
    );
    expect(
      screen.getByRole("combobox", { name: "Draft position" }),
    ).toHaveValue("B1");
    expect(JSON.stringify(state)).toBe(before);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("uses the advertised position when scouting a detailed role recommendation", () => {
    render(<LocalLeagueDraft draft={draft()} onPick={vi.fn()} />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Rank for position" }),
      { target: { value: "B1" } },
    );
    fireEvent.click(screen.getByText(/^Draft recommendations for/));
    const recommendation = screen.getAllByRole("button", {
      name: /^Scout .* · (PG|SG|SF|PF|C) fit/,
    })[0];
    const expectedSlot = recommendation.textContent!.match(
      /· (PG|SG|SF|PF|C) fit/,
    )![1];
    fireEvent.click(recommendation);
    expect(
      screen.getByRole("combobox", { name: "Draft position" }),
    ).toHaveValue(expectedSlot);
  });

  it("compares each candidate against the same roster and carries the preview slot into confirmation", () => {
    const state = draft();
    state.picks = [
      { teamId: 0, pokemonId: 65, slot: "PG" },
      { teamId: 0, pokemonId: 135, slot: "SG" },
      { teamId: 1, pokemonId: 143, slot: "C" },
    ];
    state.order = [2, 3, 1, 0, 4, 5, 6, 7];
    const saved = JSON.stringify(state);
    const onPick = vi.fn();
    render(<LocalLeagueDraft draft={state} onPick={onPick} />);
    for (const name of ["Onix", "Rhydon", "Pikachu"]) {
      search(name);
      fireEvent.click(screen.getByRole("button", { name: `Compare ${name}` }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Compare shortlist" }));
    const comparison = screen.getByRole("region", {
      name: "Compare team impact",
    });
    expect(comparison).toHaveTextContent("2 drafted players");
    const position = within(comparison).getByRole("combobox", {
      name: "Preview draft position",
    });
    expect(within(position).queryByRole("option", { name: /^PG/ })).toBeNull();
    fireEvent.change(position, { target: { value: "C" } });
    const table = within(comparison).getByRole("table", {
      name: "Team impact by candidate",
    });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(5);
    const offense = within(table).getByRole("row", {
      name: /Overall offense/,
    }).textContent;
    fireEvent.change(position, { target: { value: "B1" } });
    expect(
      within(table).getByRole("row", { name: /Overall offense/ }).textContent,
    ).not.toBe(offense);
    fireEvent.change(
      within(comparison).getByRole("combobox", { name: "Prioritize" }),
      {
        target: { value: "rebounding" },
      },
    );
    expect(within(comparison).getByRole("status")).toHaveTextContent(
      "Rebounding",
    );
    expect(within(comparison).getByRole("status")).toHaveTextContent("Rhydon");
    fireEvent.change(
      within(comparison).getByRole("combobox", { name: "Prioritize" }),
      {
        target: { value: "spacing" },
      },
    );
    expect(within(comparison).getByRole("status")).toHaveTextContent("Pikachu");
    expect(within(comparison).getByRole("status")).toHaveTextContent(
      "this team average does not rise",
    );
    expect(JSON.stringify(state)).toBe(saved);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(
      within(comparison).getByRole("button", { name: "Review Rhydon pick" }),
    );
    expect(
      screen.getByRole("combobox", { name: "Draft position" }),
    ).toHaveValue("B1");
    expect(
      screen.getByRole("region", { name: "Team impact preview" }),
    ).toHaveTextContent("Rhydon at B1");
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm pick: Rhydon" }),
    );
    expect(onPick).toHaveBeenCalledExactlyOnceWith(112, "B1");
  });

  it("previews only the current friend's team and updates the impact before confirming", () => {
    const state = draft();
    state.picks = [
      { teamId: 0, pokemonId: 65, slot: "PG" },
      { teamId: 0, pokemonId: 135, slot: "SG" },
      { teamId: 1, pokemonId: 143, slot: "C" },
    ];
    state.order = [2, 3, 1, 0, 4, 5, 6, 7];
    const onPick = vi.fn();
    render(<LocalLeagueDraft draft={state} onPick={onPick} />);
    search("Onix");
    fireEvent.click(
      screen.getByRole("button", { name: "View scouting for Onix" }),
    );
    const impact = screen.getByRole("region", { name: "Team impact preview" });
    expect(impact).toHaveTextContent("2 → 3 players");
    expect(impact).toHaveTextContent("Strongest areas after pick");
    expect(impact).toHaveTextContent("Lowest-rated areas after pick");
    const shooting = within(impact).getByRole("row", {
      name: /Shooting \/ spacing/,
    });
    expect(shooting).toHaveTextContent("−");
    const before = within(impact).getByRole("row", {
      name: /Overall offense/,
    }).textContent;
    fireEvent.change(screen.getByRole("combobox", { name: "Draft position" }), {
      target: { value: "B1" },
    });
    expect(
      within(impact).getByRole("row", { name: /Overall offense/ }).textContent,
    ).not.toBe(before);
    expect(impact).toHaveTextContent("Onix at B1");
    expect(state.picks).toHaveLength(3);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm pick: Onix" }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith(95, "B1");
  });

  it("keeps a comparison shortlist through searches without drafting anyone", () => {
    const onPick = vi.fn();
    render(<LocalLeagueDraft draft={draft()} onPick={onPick} />);
    for (const name of ["Pikachu", "Snorlax", "Charizard"]) {
      search(name);
      fireEvent.click(screen.getByRole("button", { name: `Compare ${name}` }));
    }
    search("Blastoise");
    expect(
      screen.getByRole("button", { name: "Compare Blastoise" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Compare shortlist" }));
    fireEvent.click(
      screen.getByText("Compare individual skills & physical profiles"),
    );
    const table = screen.getByRole("table", {
      name: "Pokémon draft comparison",
    });
    for (const name of ["Pikachu", "Snorlax", "Charizard"])
      expect(
        within(table).getByRole("columnheader", { name: new RegExp(name) }),
      ).toBeInTheDocument();
    expect(
      within(table).getByRole("rowheader", { name: /^Three-point shooting/ }),
    ).toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Hide comparison" }));
    expect(
      screen.queryByRole("table", { name: "Pokémon draft comparison" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare shortlist" }));
    fireEvent.click(
      screen.getByText("Compare individual skills & physical profiles"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Snorlax from comparison" }),
    );
    expect(
      screen.getByRole("button", { name: "Compare Blastoise" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Scout Pikachu" }));
    expect(
      screen.getByRole("region", { name: "Selected prospect" }),
    ).toHaveTextContent("Pikachu");
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox", { name: "Draft position" }), {
      target: { value: "SG" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm pick: Pikachu" }),
    );
    expect(onPick).toHaveBeenCalledExactlyOnceWith(25, "SG");
  });

  it("scouts for a remaining starter role and keeps drafted Pokémon out of the board", () => {
    const state = draft();
    state.picks = [
      { teamId: 0, pokemonId: 65, slot: "PG" },
      { teamId: 0, pokemonId: 135, slot: "SG" },
      { teamId: 0, pokemonId: 6, slot: "SF" },
      { teamId: 0, pokemonId: 68, slot: "PF" },
    ];
    // Pick five in the first round belongs to Sam in this controlled fixture.
    state.order = [4, 1, 2, 3, 0, 5, 6, 7];
    render(<LocalLeagueDraft draft={state} onPick={() => {}} />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Rank players by" }),
      {
        target: { value: "fit" },
      },
    );
    expect(
      screen.getByRole("combobox", { name: "Rank players by" }),
    ).toHaveValue("fit");
    search("Alakazam");
    expect(
      screen.queryByRole("button", { name: "View scouting for Alakazam" }),
    ).not.toBeInTheDocument();
    search("Snorlax");
    const card = screen.getByRole("article", {
      name: "Snorlax draft prospect",
    });
    expect(card).toHaveTextContent("C · open-role fit");
    expect(card).toHaveTextContent("Best tools");
    expect(card).toHaveTextContent("Tradeoff");
    fireEvent.click(
      within(card).getByRole("button", { name: "View scouting for Snorlax" }),
    );
    expect(
      screen.getByRole("combobox", { name: "Draft position" }),
    ).toHaveValue("C");
    expect(
      screen.getByRole("region", { name: "Selected prospect" }),
    ).toHaveTextContent("2.1 m");
    expect(
      screen.queryByRole("option", { name: "PG · Point guard" }),
    ).not.toBeInTheDocument();
  });
});
