import { describe, expect, it } from "vitest";
import { typeMatchup, typeShotEffect } from "./typeMatchups";
import { evaluateShot, type ShotContext } from "./shotModel";
import { playerProfile } from "./playerProfile";
import { POKEMON_BY_ID } from "../data/pokemon";

describe("Pokémon basketball type matchups", () => {
  it.each([
    [["fire"], ["grass"], 2],
    [["fire"], ["water"], 0.5],
    [["electric"], ["water", "flying"], 4],
    [["electric"], ["water", "ground"], 0],
    [["fire"], ["grass", "water"], 1],
    [["normal"], ["ghost"], 0],
    [["dragon"], ["fairy"], 0],
    [["ghost"], ["steel"], 1],
    [["dark"], ["steel"], 1],
    [["fairy"], ["dragon", "dark"], 4],
  ])("resolves %j against %j", (attack, defense, expected) => {
    expect(typeMatchup(attack, defense).effectiveness).toBe(expected);
  });
  it("uses the best attacking type without stacking both attacks", () => {
    const matchup = typeMatchup(["fire", "flying"], ["grass", "bug"]);
    expect(matchup.effectiveness).toBe(4);
    expect(typeMatchup(["electric", "water"], ["ground"]).attackType).toBe(
      "water",
    );
    expect(typeMatchup(["water", "electric"], ["ground"]).effectiveness).toBe(
      2,
    );
    expect(typeMatchup([], []).edge).toBe(0);
  });
  it("softens immunities into basketball resistance and keeps all effects bounded", () => {
    const resisted = typeShotEffect(["electric"], ["ground"], "rim");
    const advantage = typeShotEffect(["electric"], ["water", "flying"], "rim");
    expect(resisted.logOdds).toBeGreaterThanOrEqual(-0.28);
    expect(resisted.logOdds).toBeLessThan(0);
    expect(advantage.logOdds).toBeGreaterThan(0);
    expect(advantage.logOdds).toBeLessThanOrEqual(0.28);
    expect(typeShotEffect(["fire"], ["grass"], "three").logOdds).toBeLessThan(
      typeShotEffect(["fire"], ["grass"], "rim").logOdds,
    );
  });
  it("lets resistant help defenders reduce a rim mismatch", () => {
    const alone = typeShotEffect(["fire"], ["grass"], "rim");
    const helped = typeShotEffect(["fire"], ["grass"], "rim", [
      ["water"],
      ["dragon"],
    ]);
    expect(helped.logOdds).toBeLessThan(alone.logOdds);
    expect(
      typeShotEffect(["fire"], ["grass"], "three", [["water"]]).logOdds,
    ).toBe(typeShotEffect(["fire"], ["grass"], "three").logOdds);
  });
  it("changes real shot odds without changing ratings, and explains the difference", () => {
    const profile = playerProfile(POKEMON_BY_ID.get(25)!);
    const context: ShotContext = {
      shooter: profile,
      defender: profile,
      shooterHeight: 1,
      defenderHeight: 1,
      zone: "rim",
      play: "isolation",
      coverage: "man",
    };
    const neutral = evaluateShot(context);
    const strong = evaluateShot({
      ...context,
      shooterTypes: ["fire"],
      defenderTypes: ["grass"],
    });
    const weak = evaluateShot({
      ...context,
      shooterTypes: ["fire"],
      defenderTypes: ["water"],
    });
    expect(strong.probability).toBeGreaterThan(neutral.probability);
    expect(weak.probability).toBeLessThan(neutral.probability);
    expect(strong.probability - neutral.probability).toBeLessThan(0.07);
    expect(
      strong.factors.find((f) => f.label === "Type matchup")?.change,
    ).toBeGreaterThan(0);
    expect(
      strong.baseProbability + strong.factors.reduce((n, f) => n + f.change, 0),
    ).toBeCloseTo(strong.probability, 12);
  });
});

it("applies resistance to the bounded shot chance consistently at the upper limit", () => {
  const profile = playerProfile(POKEMON_BY_ID.get(25)!);
  const context: ShotContext = {
    shooter: {
      ...profile,
      attributes: {
        ...profile.attributes,
        finishing: 100,
        strength: 100,
        speed: 100,
      },
    },
    defender: {
      ...profile,
      attributes: {
        ...profile.attributes,
        interiorDefense: 0,
        strength: 0,
        speed: 0,
      },
    },
    shooterHeight: 3.5,
    defenderHeight: 0.1,
    zone: "rim",
    play: "transition",
    coverage: "press",
    spacing: 100,
    protection: 0,
    passing: 100,
  };
  expect(evaluateShot(context).probability).toBe(0.88);
  const shot = evaluateShot({
    ...context,
    shooterTypes: ["electric"],
    defenderTypes: ["ground"],
  });
  // logit(0.88) minus the capped 0.28 type penalty, independently calculated.
  expect(shot.probability).toBeCloseTo(0.8471512221479098, 8);
});
