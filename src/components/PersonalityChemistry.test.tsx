import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { ChemistryDetails } from "./ChemistrySummary";
import { evaluateLineupChemistry } from "../game/lineupChemistry";
import { playerProfile } from "../game/playerProfile";
import { POKEMON_BY_ID } from "../data/pokemon";

it("explains captain court presence separately from earned partner minutes", () => {
  const chemistry = evaluateLineupChemistry(
    [1, 2, 3, 4, 5].map((pokemonId) => ({
      pokemonId,
      profile: playerProfile(POKEMON_BY_ID.get(pokemonId)!),
    })),
    { tactic: "balanced", defense: "man", abilities: false, bonds: {} },
  );
  const view = render(
    <ChemistryDetails
      chemistry={{
        ...chemistry,
        leadership: {
          captainId: 1,
          style: "Organizer",
          active: true,
          cohesionDelta: 1.5,
        },
      }}
    />,
  );
  expect(view.container).toHaveTextContent("Captain Bulbasaur");
  expect(view.container).toHaveTextContent("+1.5");
  expect(view.container).toHaveTextContent("active five");
  view.rerender(
    <ChemistryDetails
      chemistry={{
        ...chemistry,
        leadership: {
          captainId: 6,
          style: "Challenger",
          active: false,
          cohesionDelta: 0,
        },
      }}
    />,
  );
  expect(view.container).toHaveTextContent("Captain Charizard");
  expect(view.container).toHaveTextContent("off court");
  expect(view.container).toHaveTextContent("no captain cohesion bonus");
});
