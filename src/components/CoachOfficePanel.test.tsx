import {
  fireEvent,
  render,
  screen,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { CoachOfficePanel } from "./CoachOfficePanel";
import { FranchisePanel } from "./FranchisePanel";
import { rookieFixture } from "../game/rookieDraft.testUtils";
import { assignLeagueCoaches, COACHES } from "../game/trainerCoaches";
import { reviewFranchiseCoaches } from "../game/coachFranchise";
import { gameReducer } from "../game/state";
import { projectedCoaches } from "../game/coachOffice";
const fixture = () => {
  const state = rookieFixture();
  const teams = assignLeagueCoaches(
    state.franchise!.teams,
    21,
    new Map([[0, { version: 1 as const, id: "ash" }]]),
  );
  return reviewFranchiseCoaches({
    ...state,
    run: { ...state.run, coach: teams[0].coach, leagueTeams: teams },
    franchise: { ...state.franchise!, teams },
  });
};
afterEach(cleanup);
it("exposes available candidates and career details with coach portraits", () => {
  const state = fixture(),
    f = state.franchise!,
    onHire = vi.fn();
  render(
    <CoachOfficePanel
      teams={f.teams}
      office={f.coachOffice}
      year={1}
      offseason
      humans={[{ teamId: 0, name: "You" }]}
      records={[]}
      onHire={onHire}
    />,
  );
  const projected = projectedCoaches(f.teams, f.coachOffice, 1);
  const available = COACHES.filter(
    (c) => !projected.some((t) => t.coach?.id === c.id),
  );
  expect(screen.getAllByRole("button", { name: /^Hire / })).toHaveLength(2);
  fireEvent.click(
    screen.getByRole("button", { name: `Hire ${available[0].name}` }),
  );
  expect(onHire).toHaveBeenCalledWith(0, available[0].id);
  fireEvent.click(screen.getByRole("button", { name: "View Misty career" }));
  expect(
    screen.getByRole("article", { name: "Misty career details" }),
  ).toHaveTextContent("No games coached");
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Find an available coach" }),
    { target: { value: "no-match" } },
  );
  expect(
    screen.getByText("No available trainers match that search."),
  ).toBeInTheDocument();
});
it("fires and rehires from the franchise tab and blocks next season while vacant", () => {
  const initial = fixture();
  const projected = projectedCoaches(
    initial.franchise!.teams,
    initial.franchise!.coachOffice,
    1,
  );
  const replacement = COACHES.find(
    (c) => !projected.some((t) => t.coach?.id === c.id),
  )!;
  function TestApp() {
    const [state, setState] = useState(initial);
    return (
      <FranchisePanel
        state={state}
        onHireCoach={(id) =>
          setState((s) => gameReducer(s, { type: "APPOINT_COACH", id }))
        }
        onEnterOffseason={() => {}}
        onStartSeason={() => {}}
        onTrade={() => {}}
      />
    );
  }
  render(<TestApp />);
  fireEvent.click(screen.getByRole("button", { name: "Coaches" }));
  fireEvent.click(screen.getByRole("button", { name: "Fire Ash Ketchum" }));
  expect(screen.getByRole("status")).toHaveTextContent("has no head coach");
  fireEvent.click(screen.getByRole("button", { name: "Offseason" }));
  expect(screen.getByRole("button", { name: "Start season 2" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Coaches" }));
  fireEvent.click(
    screen.getByRole("button", { name: `Hire ${replacement.name}` }),
  );
  expect(
    screen.getByRole("region", {
      name: `${replacement.name} automatic coaching`,
    }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Offseason" }));
  expect(screen.getByRole("button", { name: "Start season 2" })).toBeEnabled();
});
it("keeps hiring closed during the season and shows historical series results", () => {
  const f = fixture().franchise!;
  const records = [
    {
      year: 1,
      teamId: 0,
      coachId: "ash",
      wins: 52,
      losses: 30,
      playoffSeed: 1,
      champion: true,
      complete: true,
      postseasonKnown: true,
      rounds: [
        {
          round: 3,
          opponentId: 1,
          wins: 4,
          losses: 2,
          result: "won" as const,
          finals: true,
        },
      ],
    },
  ];
  render(
    <CoachOfficePanel
      teams={f.teams}
      year={2}
      offseason={false}
      humans={[{ teamId: 0, name: "You" }]}
      records={records}
      onHire={vi.fn()}
    />,
  );
  expect(screen.queryByRole("button", { name: /^Hire |^Fire / })).toBeNull();
  const detail = screen.getByRole("article", {
    name: "Ash Ketchum career details",
  });
  expect(detail).toHaveTextContent("52–30");
  expect(detail).toHaveTextContent("Champion");
  expect(within(detail).getByText(/Finals vs .* won 4–2/)).toBeInTheDocument();
});

import { OffseasonRoster } from "./OffseasonRoster";
import { appointFranchiseCoach } from "../game/coachFranchise";
it("shows the appointed coach in offseason roster management instead of the frozen prior coach", () => {
  const initial = fixture();
  const projected = projectedCoaches(
    initial.franchise!.teams,
    initial.franchise!.coachOffice,
    1,
  );
  const replacement = COACHES.find(
    (c) => !projected.some((t) => t.coach?.id === c.id),
  )!;
  const hired = appointFranchiseCoach(initial, replacement.id);
  const { rerender } = render(
    <OffseasonRoster franchise={hired.franchise!} onChange={() => {}} />,
  );
  expect(
    screen.getByRole("region", {
      name: `${replacement.name} automatic coaching`,
    }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Ash Ketchum automatic coaching" }),
  ).toBeNull();
  const fired = appointFranchiseCoach(hired, null);
  rerender(
    <OffseasonRoster franchise={fired.franchise!} onChange={() => {}} />,
  );
  expect(
    screen.queryByRole("region", { name: /automatic coaching/ }),
  ).toBeNull();
  expect(
    screen.getByText(/Hire a head coach in the Coaches tab/),
  ).toBeInTheDocument();
});
