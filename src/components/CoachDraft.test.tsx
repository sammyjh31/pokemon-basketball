import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CoachDraft } from "./CoachDraft";
import { coachOffers } from "../game/trainerCoaches";
afterEach(cleanup);
it("limits challenge choice to its three offers and submits the chosen trainer", () => {
  const pick = vi.fn();
  render(<CoachDraft seed={22} offered onChoose={pick} />);
  expect(screen.getAllByRole("button", { name: /Draft / })).toHaveLength(3);
  const coach = coachOffers(22)[0];
  fireEvent.click(screen.getByRole("button", { name: `Draft ${coach.name}` }));
  expect(pick).toHaveBeenCalledWith(coach.id);
  expect(screen.queryByRole("searchbox")).toBeNull();
});
it("searches freely in local drafts while identifying taken coaches", () => {
  const pick = vi.fn();
  render(
    <CoachDraft seed={22} taken={["mom"]} manager="Sam" onChoose={pick} />,
  );
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Mom" } });
  expect(screen.getByRole("button", { name: /Delia/ })).toBeDisabled();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Sabrina" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Draft Sabrina" }));
  expect(pick).toHaveBeenCalledWith("sabrina");
});

import App from "../App";
import { initialState } from "../game/state";
it("completes the real new-run coach step and removes manual coaching controls", () => {
  const initial = initialState(22);
  initial.run.coachDraftRequired = true;
  const offered = coachOffers(initial.run.seasonSeed)[0];
  render(
    <App
      initial={initial}
      storage={{ getItem: () => null, setItem: () => {} }}
    />,
  );
  expect(screen.queryByRole("button", { name: "Simulate season" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: `Draft ${offered.name}` }),
  );
  expect(
    screen.getByRole("region", { name: `${offered.name} automatic coaching` }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Simulate season" }),
  ).toBeDisabled();
  expect(screen.queryByLabelText("Coaching style")).toBeNull();
  expect(screen.queryByLabelText("Defensive scheme")).toBeNull();
});

import { gameReducer } from "../game/state";
import { rookieFixture } from "../game/rookieDraft.testUtils";
import "../test/preloadPanels";
it("gates the franchise overview's simulation shortcut until a coach is chosen", () => {
  const initial = gameReducer(rookieFixture(), {
    type: "START_FRANCHISE_SEASON",
    seed: 82,
  });
  expect(initial.run.coachDraftRequired).toBe(true);
  render(
    <App
      initial={initial}
      storage={{ getItem: () => null, setItem: () => {} }}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Simulate season 2" }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Draft Delia Ketchum (Mom)" }),
  );
  expect(
    screen.getByRole("button", { name: "Simulate season 2" }),
  ).toBeEnabled();
});
