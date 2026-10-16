import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRun } from "../game/draft";
import { ArcadeMode } from "./ArcadeMode";
vi.mock("../arcade/renderer", () => ({
  loadArcadeAssets: async () => new Map(),
  drawArcade: () => {},
}));
afterEach(() => vi.restoreAllMocks());
describe("arcade exhibition flow", () => {
  it("starts an exhibition, pauses, and requires an explicit abandon choice before returning to the unchanged roster", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: () => {},
    } as unknown as CanvasRenderingContext2D);
    const run = {
      ...createRun("free", false, 11),
      roster: {
        PG: 65,
        SG: 135,
        SF: 149,
        PF: 68,
        C: 143,
        B1: 121,
        B2: 6,
        B3: 131,
      },
    };
    const before = JSON.stringify(run),
      exit = vi.fn();
    render(<ArcadeMode run={run} onExit={exit} />);
    const tipoff = screen.getByRole("button", { name: /tip off/i });
    await waitFor(() => expect(tipoff).toBeEnabled());
    fireEvent.click(tipoff);
    expect(
      screen.getByLabelText(/five-on-five basketball court/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause game" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave exhibition" }));
    const dialog = screen.getByRole("dialog", { name: "Leave this game?" });
    expect(exit).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Keep playing" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Time out" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave exhibition" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(exit).toHaveBeenCalledOnce();
    expect(JSON.stringify(run)).toBe(before);
  });
});
