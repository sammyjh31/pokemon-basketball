import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CoachTrainingPanel, CoachTrainingDetails } from "./CoachTrainingPanel";
import { FranchisePanel } from "./FranchisePanel";
import { rookieFixture } from "../game/rookieDraft.testUtils";
import { coachTrainingPlans } from "../game/coachTraining";
import { assignLeagueCoaches, COACHES } from "../game/trainerCoaches";
import {
  reviewFranchiseCoaches,
  appointFranchiseCoach,
} from "../game/coachFranchise";
import { projectedCoaches } from "../game/coachOffice";
afterEach(cleanup);
const team = () => ({
  ...rookieFixture().franchise!.teams[0],
  coach: { version: 1 as const, id: "ash" },
});
it("shows eight automatic plans with reasons and no manual controls", () => {
  render(<CoachTrainingPanel team={team()} />);
  expect(
    screen.getByRole("heading", { name: "Ash Ketchum's training plans" }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("article")).toHaveLength(8);
  expect(screen.getAllByText("Why this plan?")).toHaveLength(8);
  expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  expect(
    screen.getByText(/before offseason coaching changes/),
  ).toBeInTheDocument();
});
it("updates previews for a new coach without changing archived camp attribution", () => {
  const t = team(),
    assignment = coachTrainingPlans(t)[t.roster.PG!]!;
  const view = render(
    <>
      <CoachTrainingPanel team={t} />
      <aside aria-label="Completed camp">
        <CoachTrainingDetails assignment={assignment} />
      </aside>
    </>,
  );
  view.rerender(
    <>
      <CoachTrainingPanel team={{ ...t, coach: { version: 1, id: "mom" } }} />
      <aside aria-label="Completed camp">
        <CoachTrainingDetails assignment={assignment} />
      </aside>
    </>,
  );
  expect(
    screen.getByRole("heading", {
      name: "Delia Ketchum (Mom)'s training plans",
    }),
  ).toBeInTheDocument();
  expect(
    within(
      screen.getByRole("complementary", { name: "Completed camp" }),
    ).getByText("Ash Ketchum", { exact: true }),
  ).toBeInTheDocument();
});
it("opens automatic training in franchise without a manual-save callback and uses next year's hire", () => {
  const original = rookieFixture();
  const teams = assignLeagueCoaches(
    original.franchise!.teams,
    12,
    new Map([[0, { version: 1, id: "ash" }]]),
  );
  const initial = reviewFranchiseCoaches({
    ...original,
    run: { ...original.run, coach: teams[0].coach },
    franchise: { ...original.franchise!, teams },
  });
  const props = {
    onEnterOffseason: vi.fn(),
    onStartSeason: vi.fn(),
    onTrade: vi.fn(),
  };
  const view = render(<FranchisePanel {...props} state={initial} />);
  fireEvent.click(screen.getByRole("button", { name: "Training plans" }));
  expect(
    screen.getByRole("heading", { name: "Ash Ketchum's training plans" }),
  ).toBeInTheDocument();
  const fired = appointFranchiseCoach(initial, null);
  view.rerender(<FranchisePanel {...props} state={fired} />);
  expect(
    screen.getByText(/Hire a head coach.*training plans/),
  ).toBeInTheDocument();
  const available = COACHES.find(
    (c) =>
      c.id !== "ash" &&
      !projectedCoaches(teams, fired.franchise!.coachOffice, 1).some(
        (t) => t.coach?.id === c.id,
      ),
  )!;
  view.rerender(
    <FranchisePanel
      {...props}
      state={appointFranchiseCoach(fired, available.id)}
    />,
  );
  expect(
    screen.getByRole("heading", { name: `${available.name}'s training plans` }),
  ).toBeInTheDocument();
});
