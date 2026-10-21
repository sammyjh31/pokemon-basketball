import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createRun } from "../game/draft";
import { DraftPickDock } from "./DraftPickDock";

it("requires confirmation and places the selected Pokémon in the chosen open slot", () => {
  const place = vi.fn();
  render(
    <DraftPickDock
      run={createRun("spin", true, 1)}
      pokemonId={800}
      onPlace={place}
      onCancel={() => {}}
    />,
  );
  expect(screen.getByLabelText("Pick position")).toHaveValue("PF");
  expect(place).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Pick position"), {
    target: { value: "PF" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Place at PF" }));
  expect(place).toHaveBeenCalledExactlyOnceWith("PF");
});
it("excludes occupied challenge slots and can cancel without placing", () => {
  const run = createRun("spin", true, 1);
  run.roster.PG = 1;
  const cancel = vi.fn(),
    place = vi.fn();
  render(
    <DraftPickDock
      run={run}
      pokemonId={25}
      onPlace={place}
      onCancel={cancel}
    />,
  );
  expect(screen.queryByRole("option", { name: /^PG/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel selection" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(place).not.toHaveBeenCalled();
});
it("labels replacements in free draft and blocks confirmation while busy", () => {
  const run = createRun("free", true, 1);
  run.roster.PG = 1;
  const place = vi.fn();
  render(
    <DraftPickDock
      run={run}
      pokemonId={25}
      onPlace={place}
      onCancel={() => {}}
      disabled
    />,
  );
  expect(
    screen.getByRole("option", { name: /PG.*Replace Bulbasaur/ }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Pick position")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /^Place at/ }));
  expect(place).not.toHaveBeenCalled();
});

it("makes a free-draft replacement explicit before placing", () => {
  const run = createRun("free", true, 1);
  run.roster.PG = 1;
  const place = vi.fn();
  render(
    <DraftPickDock
      run={run}
      pokemonId={25}
      onPlace={place}
      onCancel={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Pick position"), {
    target: { value: "PG" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Replace Bulbasaur at PG" }),
  );
  expect(place).toHaveBeenCalledExactlyOnceWith("PG");
});
it("has no available placement after a challenge roster is full", () => {
  const run = createRun("spin", true, 1);
  run.roster = { PG: 1, SG: 4, SF: 7, PF: 25, C: 95, B1: 65, B2: 6, B3: 9 };
  const place = vi.fn();
  render(
    <DraftPickDock
      run={run}
      pokemonId={800}
      onPlace={place}
      onCancel={() => {}}
    />,
  );
  expect(screen.getByLabelText("Pick position")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /Place at/ }));
  expect(place).not.toHaveBeenCalled();
});
