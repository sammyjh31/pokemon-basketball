import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { signatureTeam } from "../game/signatureTestUtils";
import { coachCombos } from "../game/comboPolicy";
import { MovesetPanel, MoveUsage, GameComboReport } from "./MovesetPanel";
it("explains locked signatures and chemistry-led coach pair plans without manual controls", () => {
  const team = signatureTeam();
  team.abilityMastery = { 25: 0 };
  render(<MovesetPanel team={team} pokemonId={25} />);
  const panel = screen.getByRole("region", { name: "Basketball movesets" });
  expect(panel).toHaveTextContent(/25 XP/);
  expect(panel).toHaveTextContent(/100 XP/);
  expect(panel).toHaveTextContent(/Volt Tackle.*locked/i);
  expect(panel).toHaveTextContent(/chemistry/i);
  expect(panel).toHaveTextContent(/25 each/);
  expect(panel.querySelector("select,input,button")).toBeNull();
});
it("shows actual signature and combo counters and distinguishes created shots from makes", () => {
  render(
    <MoveUsage
      rows={[
        {
          key: 25,
          label: "Pikachu",
          abilityActivations: {
            offense: 0,
            defense: 0,
            support: 0,
            moves: {
              uses: { "pikachu-volt-tackle": 3 },
              energySpent: 12,
              energyRecovered: 0,
              combos: {
                attempts: { "pick-roll": 4 },
                shotsCreated: { "pick-roll": 2 },
              },
            },
          },
        },
      ]}
    />,
  );
  const usage = screen.getByRole("region", { name: "Basketball move usage" });
  expect(usage).toHaveTextContent(/Volt Tackle ×3/);
  expect(usage).toHaveTextContent(/4 setups.*2 shots created/);
  expect(usage).toHaveTextContent(/made baskets/i);
});
it("keeps frozen game plans separate from actual events and hides absent legacy data", () => {
  const team = signatureTeam(),
    plans = coachCombos(team);
  const view = render(
    <GameComboReport assignments={{ 0: plans }} sequences={[]} />,
  );
  const region = screen.getByRole("region", { name: "Game combo plays" });
  expect(region).toHaveTextContent(/Frozen pregame/);
  expect(region).toHaveTextContent(/No recorded combo actions/);
  view.rerender(<GameComboReport />);
  expect(view.container).toBeEmptyDOMElement();
});
