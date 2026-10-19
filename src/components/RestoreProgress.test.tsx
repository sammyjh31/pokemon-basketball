import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RestoreProgress } from "./RestoreProgress";
it("announces opening a verified save without an impossible zero-game counter", () => {
  render(
    <RestoreProgress
      completed={0}
      total={0}
      label="Saved league restoration progress"
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Opening saved league…");
  expect(screen.getByRole("status")).not.toHaveTextContent("0 / 0");
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "1");
});
it("shows only the games that actually need verification on a cache miss", () => {
  render(
    <RestoreProgress
      completed={15}
      total={30}
      label="Saved league restoration progress"
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "15 / 30 games restored",
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "15");
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "30");
});
