import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { AbilityStats } from "./AbilityStats";
import { DepthScouting } from "./DepthScouting";
import { SpeciesAbility } from "./SpeciesAbility";

it("separates actual physical counters from shot totals and distinguishes historical missing data from recorded zero", () => {
  render(
    <AbilityStats
      label="Career ability activations"
      rows={[
        {
          key: 1,
          label: "Current",
          pokemonId: 68,
          abilityActivations: {
            offense: 2,
            support: 3,
            defense: 4,
            physical: {
              movement: 12.5,
              screens: 6,
              rebounds: 7,
              energySaved: 3.25,
            },
          },
        },
        {
          key: 2,
          label: "Older season",
          abilityActivations: { offense: 2, support: 0, defense: 0 },
        },
        {
          key: 3,
          label: "Recorded zero",
          abilityActivations: {
            offense: 0,
            support: 0,
            defense: 0,
            physical: { movement: 0, screens: 0, rebounds: 0, energySaved: 0 },
          },
        },
      ]}
    />,
  );
  const shots = screen.getByRole("table", {
    name: "Career ability activations",
  });
  const effects = screen.getByRole("table", {
    name: "Career ability activations physical effects",
  });
  const cells = (table: HTMLElement, name: string) =>
    within(within(table).getByRole("rowheader", { name }).closest("tr")!)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
  expect(cells(shots, "Current")[0]).toBe("9");
  expect(cells(effects, "Current")).toEqual(["12.5", "6", "7", "3.3"]);
  expect(cells(effects, "Older season")).toEqual(["—", "—", "—", "—"]);
  expect(cells(effects, "Recorded zero")).toEqual(["0", "0", "0", "0"]);
  expect(
    screen.getByText(/extra distance actually traveled/i),
  ).toBeInTheDocument();
});

it("describes current physical basketball adaptations without attributing them to older seasons", () => {
  render(<SpeciesAbility pokemonId={68} />);
  const ability = screen.getByRole("region", {
    name: "Machamp species ability",
  });
  expect(ability).toHaveTextContent(/12% stronger screens/i);
  expect(ability).toHaveTextContent(/physical ability rules/i);
  expect(ability).toHaveTextContent(/older.*original rules/i);
});

it("only applies physical scouting descriptions when the league has enabled them", () => {
  const mon = POKEMON_BY_ID.get(68)!;
  const { rerender } = render(
    <DepthScouting
      mon={mon}
      abilities
      abilityVersion={1}
      physicalAbilityVersion={1}
    />,
  );
  expect(screen.getByRole("region")).toHaveTextContent(/12% stronger screens/i);
  rerender(<DepthScouting mon={mon} abilities abilityVersion={1} />);
  expect(screen.getByRole("region")).not.toHaveTextContent(/stronger screens/i);
  rerender(
    <DepthScouting
      mon={mon}
      abilities={false}
      abilityVersion={1}
      physicalAbilityVersion={1}
    />,
  );
  expect(screen.getByRole("region")).not.toHaveTextContent(/stronger screens/i);
});
