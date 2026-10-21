import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { KantoNavigation, LocalMasthead } from "./KantoShell";
it("opens a hidden team section without leaving the local league route", () => {
  window.history.replaceState(null, "", "/#local-league");
  render(
    <>
      <KantoNavigation team />
      <details>
        <summary>Current teams</summary>
        <section id="team">Saved team</section>
      </details>
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Team" }));
  expect(screen.getByText("Current teams").closest("details")).toHaveAttribute(
    "open",
  );
  expect(window.location.hash).toBe("#local-league");
  expect(screen.getByRole("button", { name: "Team" })).toHaveAttribute(
    "aria-current",
    "location",
  );
  expect(screen.getByRole("button", { name: "Playoffs" })).toBeDisabled();
  window.history.replaceState(null, "", "/");
});

it("keeps the exit unavailable while a simulation batch is running", () => {
  render(
    <LocalMasthead
      onExit={() => {}}
      onRestart={() => {}}
      disabled
      restartDisabled
    />,
  );
  expect(screen.getByRole("button", { name: "Back to game" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "New local league" }),
  ).toBeDisabled();
});

it("exposes a local restart without opening league options", () => {
  let requested = false;
  render(
    <LocalMasthead
      onExit={() => {}}
      onRestart={() => {
        requested = true;
      }}
    />,
  );
  const restart = screen.getByRole("button", { name: "New local league" });
  expect(restart.closest("details")).toBeNull();
  fireEvent.click(restart);
  expect(requested).toBe(true);
});

it("takes Draft navigation directly to available players instead of the court", () => {
  render(
    <>
      <KantoNavigation />
      <section id="draft">
        <section id="draft-board">Available players</section>
      </section>
    </>,
  );
  const board = document.getElementById("draft-board")!;
  const scroll = vi.fn();
  board.scrollIntoView = scroll;
  fireEvent.click(screen.getByRole("button", { name: "Draft" }));
  expect(scroll).toHaveBeenCalledOnce();
});
it("keeps Draft navigation working in local leagues without a solo board", () => {
  render(
    <>
      <KantoNavigation />
      <section id="draft">Local draft clock</section>
    </>,
  );
  const scroll = vi.fn();
  document.getElementById("draft")!.scrollIntoView = scroll;
  fireEvent.click(screen.getByRole("button", { name: "Draft" }));
  expect(scroll).toHaveBeenCalledOnce();
});
