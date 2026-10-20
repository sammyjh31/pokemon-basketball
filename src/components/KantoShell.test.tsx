import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
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
  render(<LocalMasthead onExit={() => {}} disabled />);
  expect(screen.getByRole("button", { name: "Back to game" })).toBeDisabled();
});
