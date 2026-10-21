import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { isShinyPokemon } from "../game/shiny";
import { Portrait } from "./Portrait";
import { ShinyBadge, ShinyContext } from "./ShinyPokemon";
import { SpriteContext } from "./SpriteControls";
it("uses a bundled canonical shiny portrait and explicit badge beneath the hosted path", () => {
  vi.stubEnv("BASE_URL", "/pokemon-basketball/");
  let seed = 0;
  while (!isShinyPokemon(25, seed)) seed++;
  const mon = POKEMON_BY_ID.get(25)!;
  const { rerender } = render(
    <ShinyContext.Provider value={seed}>
      <SpriteContext.Provider value="pixel">
        <Portrait mon={mon} />
        <ShinyBadge mon={mon} />
      </SpriteContext.Provider>
    </ShinyContext.Provider>,
  );
  expect(screen.getByRole("img", { name: "Shiny Pikachu" })).toHaveAttribute(
    "src",
    "/pokemon-basketball/pokemon-shiny/25.png",
  );
  expect(screen.getByText("SHINY +3")).toBeInTheDocument();
  rerender(
    <SpriteContext.Provider value="artwork">
      <Portrait mon={mon} />
    </SpriteContext.Provider>,
  );
  expect(screen.getByRole("img", { name: "Pikachu" })).toHaveAttribute(
    "src",
    "/pokemon-basketball/pokemon/25.png",
  );
  expect(screen.queryByText("SHINY +3")).not.toBeInTheDocument();
  vi.unstubAllEnvs();
});
