import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { MatchupLab } from "./MatchupLab";
it("lets players explore the simulator's live shooting, fatigue and coverage probabilities", () => {
  render(<MatchupLab />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open matchup explorer" }),
  );
  const output = screen.getByLabelText("Shot make probability");
  const fresh = Number(output.textContent!.replace("%", ""));
  fireEvent.change(screen.getByLabelText("Shooter energy"), {
    target: { value: "20" },
  });
  expect(Number(output.textContent!.replace("%", ""))).toBeLessThan(fresh);
  fireEvent.change(screen.getByLabelText("Shooter energy"), {
    target: { value: "100" },
  });
  fireEvent.change(screen.getByLabelText("Defensive coverage"), {
    target: { value: "zone" },
  });
  expect(Number(output.textContent!.replace("%", ""))).toBeGreaterThan(fresh);
  expect(
    screen.getByText(/before blocks and shooting fouls/),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("option", { name: /Lucario/ })).toHaveLength(2);
});

it("includes Generation IX players from full-pool leagues", () => {
  render(<MatchupLab />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open matchup explorer" }),
  );
  expect(
    within(screen.getByLabelText("Shooter")).getAllByRole("option").at(-1),
  ).toHaveValue("1025");
  fireEvent.change(screen.getByLabelText("Shooter"), {
    target: { value: "1025" },
  });
  expect(screen.getByLabelText("Shot make probability")).not.toHaveTextContent(
    "NaN",
  );
});
