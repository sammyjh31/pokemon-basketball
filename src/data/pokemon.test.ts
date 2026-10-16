// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import data from "./pokemon.json";
import { POKEMON, POKEMON_BY_ID } from "./pokemon";

describe("the Generation I and II player catalog", () => {
  it("provides 240 distinct eligible players for thirty eight-player rosters", () => {
    expect(POKEMON.map((mon) => mon.id)).toEqual(
      Array.from({ length: 251 }, (_, index) => index + 1),
    );
    expect(
      new Set(POKEMON.filter((mon) => !mon.legendary).map((mon) => mon.id))
        .size,
    ).toBe(240);
    expect(POKEMON.filter((mon) => mon.legendary).map((mon) => mon.id)).toEqual(
      [144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251],
    );
    expect(POKEMON_BY_ID.get(250)?.name).toBe("Ho-Oh");
  });

  it("preserves the original 151 factual records used to replay saved seasons", () => {
    const digest = createHash("sha256")
      .update(JSON.stringify(data.slice(0, 151)))
      .digest("hex");
    expect(digest).toBe(
      "e55eff8e128d92e83f81815c208598668f3e2b89dda1bf9c26c7d16bb8bf20a7",
    );
  });

  it("loads valid factual measurements and six base stats for every added player", () => {
    expect(POKEMON_BY_ID.get(208)).toMatchObject({
      name: "Steelix",
      types: ["steel", "ground"],
      heightM: 9.2,
      weightKg: 400,
      stats: {
        hp: 75,
        attack: 85,
        defense: 200,
        specialAttack: 55,
        specialDefense: 65,
        speed: 30,
      },
    });
    for (const mon of POKEMON.slice(151)) {
      expect(Object.values(mon.stats)).toHaveLength(6);
      expect(
        Object.values(mon.stats).every(
          (value) => Number.isFinite(value) && value > 0,
        ),
      ).toBe(true);
      expect(mon.types.length).toBeGreaterThan(0);
      expect(mon.heightM).toBeGreaterThan(0);
      expect(mon.weightKg).toBeGreaterThan(0);
      expect(mon.spriteUrl).toBe(`/pokemon/${mon.id}.png`);
    }
  });

  it.each(["pokemon", "pokemon-pixel"])(
    "bundles all 251 %s PNGs with matching source manifests",
    (folder) => {
      const base = resolve("public", folder);
      const manifest = JSON.parse(
        readFileSync(resolve(base, "manifest.json"), "utf8"),
      );
      const entries: [string, { source: string; sha256: string }][] =
        Array.isArray(manifest)
          ? manifest.map((entry) => [String(entry.id), entry])
          : Object.entries(manifest);
      expect(entries).toHaveLength(251);
      expect(entries.map(([id]) => Number(id)).sort((a, b) => a - b)).toEqual(
        Array.from({ length: 251 }, (_, index) => index + 1),
      );
      for (const [id, entry] of entries) {
        const png = readFileSync(resolve(base, `${id}.png`));
        expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect(createHash("sha256").update(png).digest("hex")).toBe(
          entry.sha256,
        );
        expect(entry.source).toMatch(
          /^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\//,
        );
      }
    },
  );
});
