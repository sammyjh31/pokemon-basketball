// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as catalog from "./pokemon";

describe("rookie player catalog", () => {
  it("looks up later-generation prospects without changing the original draft pool", () => {
    expect(catalog.POKEMON_BY_ID.get(252)).toMatchObject({
      name: "Treecko",
      heightM: 0.5,
      weightKg: 5,
      types: ["grass"],
      stats: {
        hp: 40,
        attack: 45,
        defense: 35,
        specialAttack: 65,
        specialDefense: 55,
        speed: 70,
      },
    });
    expect(catalog.POKEMON_BY_ID.get(1025)?.name).toBe("Pecharunt");
    expect(catalog.POKEMON).toHaveLength(251);
    expect(
      createHash("sha256")
        .update(
          JSON.stringify(
            JSON.parse(readFileSync("src/data/pokemon.json", "utf8")).slice(
              0,
              251,
            ),
          ),
        )
        .digest("hex"),
    ).toBe("b956ce8654db22c7831ce4c29bb83a8b2b381e5c80d4986e2ddca3f64a861352");
  });

  it.each(["pokemon", "pokemon-pixel"])(
    "can render every later-generation rookie from verified local %s images",
    (folder) => {
      const manifest = JSON.parse(
        readFileSync(resolve("public", folder, "rookie-manifest.json"), "utf8"),
      ) as Record<string, { source: string; sha256: string }>;
      expect(Object.keys(manifest).map(Number)).toEqual(
        catalog.ROOKIE_POKEMON.map((mon) => mon.id),
      );
      for (const mon of catalog.ROOKIE_POKEMON) {
        const entry = manifest[mon.id];
        const png = readFileSync(resolve("public", folder, `${mon.id}.png`));
        expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect(createHash("sha256").update(png).digest("hex")).toBe(
          entry.sha256,
        );
        expect(entry.source).toMatch(
          /^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/[a-f0-9]{40}\//,
        );
      }
    },
  );
});
