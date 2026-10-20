import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { loadArcadeAssets } from "../arcade/renderer";
import { Portrait } from "./Portrait";
import { SpriteContext } from "./SpriteControls";
import { CoachDraft } from "./CoachDraft";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("loads both portrait styles below the Pages path without rewriting saved catalog URLs", () => {
  vi.stubEnv("BASE_URL", "/pokemon-basketball/");
  const pikachu = POKEMON_BY_ID.get(25)!;
  const { rerender } = render(
    <SpriteContext.Provider value="artwork">
      <Portrait mon={pikachu} />
    </SpriteContext.Provider>,
  );
  expect(screen.getByRole("img", { name: "Pikachu" })).toHaveAttribute(
    "src",
    "/pokemon-basketball/pokemon/25.png",
  );
  rerender(
    <SpriteContext.Provider value="pixel">
      <Portrait mon={pikachu} />
    </SpriteContext.Provider>,
  );
  expect(screen.getByRole("img", { name: "Pikachu" })).toHaveAttribute(
    "src",
    "/pokemon-basketball/pokemon-pixel/25.png",
  );
  expect(pikachu.spriteUrl).toBe("/pokemon/25.png");
});

it("keeps coach images and their credits inside the published game", () => {
  vi.stubEnv("BASE_URL", "/pokemon-basketball/");
  render(<CoachDraft seed={22} offered onChoose={() => {}} />);
  for (const image of screen.getAllByRole("img")) {
    expect(image.getAttribute("src")).toMatch(
      /^\/pokemon-basketball\/coaches\/[a-z-]+\.png$/,
    );
  }
  expect(
    screen.getByRole("link", { name: "Portrait credits" }),
  ).toHaveAttribute("href", "/pokemon-basketball/coaches/credits.html");
});

it.each(["/", "/pokemon-basketball/"])(
  "preloads actual arcade sprites beneath %s",
  async (base) => {
    vi.stubEnv("BASE_URL", base);
    const requested: string[] = [];
    class LoadedImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        requested.push(value);
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", LoadedImage);
    const assets = await loadArcadeAssets([25, 26]);
    expect(requested).toEqual([
      `${base}pokemon-pixel/25.png`,
      `${base}pokemon-pixel/26.png`,
    ]);
    expect([...assets.keys()]).toEqual([25, 26]);
  },
);
