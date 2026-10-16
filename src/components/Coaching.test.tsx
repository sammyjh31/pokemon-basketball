import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRun } from "../game/draft";
import type { RotationPlan } from "../game/franchiseFeatures";
import { RotationEditor } from "./RotationEditor";
import { TrainingPanel } from "./TrainingPanel";

const roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: 121,
  B2: 6,
  B3: 131,
};
const plan: RotationPlan = {
  minutes: { PG: 40, SG: 40, SF: 40, PF: 40, C: 40, B1: 20, B2: 20, B3: 0 },
  closing: ["PG", "SG", "SF", "PF", "C"],
};
const run = { ...createRun("free", false, 1), roster, rotationPlan: plan };

describe("coaching controls", () => {
  it("keeps minute edits local, blocks invalid totals and saves a validated plan", () => {
    const onChange = vi.fn();
    render(<RotationEditor run={run} onChange={onChange} />);
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Alakazam target minutes" }),
      { target: { value: "39" } },
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Save rotation" }),
    ).toBeDisabled();
    expect(screen.getByText(/239 \/ 240/)).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Starmie target minutes" }),
      { target: { value: "21" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save rotation" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...plan,
      minutes: { ...plan.minutes, PG: 39, B1: 21 },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Use automatic rotation" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("requires five positive-minute closers and locks all controls when disabled", () => {
    const onChange = vi.fn();
    const view = render(<RotationEditor run={run} onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Alakazam closes games" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Lapras closes games" }),
    );
    expect(
      screen.getByRole("button", { name: "Save rotation" }),
    ).toBeDisabled();
    expect(screen.getByText(/positive target minutes/)).toBeInTheDocument();
    view.rerender(<RotationEditor run={run} disabled onChange={onChange} />);
    expect(
      screen.getByRole("spinbutton", { name: "Alakazam target minutes" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Starmie closes games" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Use automatic rotation" }),
    ).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("saves training choices explicitly for current players and supports target positions", () => {
    const onChange = vi.fn();
    render(<TrainingPanel roster={roster} onChange={onChange} />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Alakazam training focus" }),
      { target: { value: "position" } },
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Alakazam target position" }),
      { target: { value: "C" } },
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Alakazam training intensity" }),
      { target: { value: "aggressive" } },
    );
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Save training plans" }),
    );
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0][65]).toEqual({
      focus: "position",
      intensity: "aggressive",
      position: "C",
    });
    expect(Object.keys(onChange.mock.calls[0][0])).toHaveLength(8);
    expect(screen.getByRole("status")).toHaveTextContent(
      /next unprocessed offseason/,
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Alakazam training focus" }),
      { target: { value: "shooting" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save training plans" }),
    );
    expect(onChange.mock.calls[1][0][65]).toEqual({
      focus: "shooting",
      intensity: "aggressive",
    });
  });

  it("refreshes draft training after roster changes and disables editing while saving", () => {
    const onChange = vi.fn();
    const view = render(
      <TrainingPanel
        roster={roster}
        plans={{ 65: { focus: "shooting", intensity: "steady" } }}
        onChange={onChange}
      />,
    );
    view.rerender(
      <TrainingPanel roster={{ ...roster, PG: 1 }} onChange={onChange} />,
    );
    expect(
      screen.queryByRole("combobox", { name: "Alakazam training focus" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Save training plans" }),
    );
    expect(onChange.mock.calls[0][0][65]).toBeUndefined();
    expect(onChange.mock.calls[0][0][1]).toEqual({
      focus: "balanced",
      intensity: "standard",
    });
    view.rerender(
      <TrainingPanel roster={roster} disabled onChange={onChange} />,
    );
    expect(
      screen.getByRole("combobox", { name: "Alakazam training focus" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Save training plans" }),
    ).toBeDisabled();
  });
});
