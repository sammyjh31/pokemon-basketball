import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { initialState, gameReducer } from "../game/state";
import { createLeague } from "../game/league";
import { ROSTER_SLOTS } from "../game/types";
import { OffseasonRoster } from "./OffseasonRoster";
function Host() {
  const base = initialState(47);
  base.run.includeLegends = true;
  base.run.roster = Object.fromEntries(
    ROSTER_SLOTS.map((s, i) => [s, [65, 150, 149, 68, 143, 9, 94, 59][i]]),
  ) as typeof base.run.roster;
  base.franchise = {
    modelVersion: 3,
    year: 1,
    phase: "offseason",
    teams: createLeague(base.run),
    history: [],
    careers: [],
    trades: [],
  };
  const [state, setState] = useState(base);
  return (
    <OffseasonRoster
      franchise={state.franchise!}
      onChange={(settings) =>
        setState((s) => gameReducer(s, { type: "OFFSEASON_ROSTER", settings }))
      }
    />
  );
}
it("swaps an offseason starter with a reserve and persists coaching and minutes", () => {
  render(<Host />);
  fireEvent.change(
    screen.getByRole("combobox", { name: "Point guard player" }),
    { target: { value: "9" } },
  );
  expect(
    screen.getByRole("combobox", { name: "Point guard player" }),
  ).toHaveValue("9");
  expect(
    screen.getByRole("combobox", { name: "Sixth player player" }),
  ).toHaveValue("65");
  fireEvent.change(
    screen.getByRole("combobox", { name: "Offseason offense" }),
    { target: { value: "pace" } },
  );
  expect(
    screen.getByRole("combobox", { name: "Offseason offense" }),
  ).toHaveValue("pace");
  const rotation = screen.getByRole("region", { name: "Rotation minutes" });
  fireEvent.click(
    within(rotation).getByRole("button", { name: "Save rotation" }),
  );
  expect(
    within(screen.getByRole("region", { name: "Rotation minutes" })).getByText(
      "Custom targets",
    ),
  ).toBeInTheDocument();
});
