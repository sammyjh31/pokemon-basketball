import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import {
  bodyProfile,
  matchupEdges,
  matchupPreference,
  resolveBodyMatchup,
  reboundBody,
  screenLeverage,
  previewBodyShot,
} from "./bodyMatchups";
const mon = POKEMON_BY_ID.get(25)!;
const fixed = playerProfile(mon);
const actor = (
  heightM = 1.5,
  weightKg = 80,
  types = ["normal"],
  energy = 100,
) => ({
  body: bodyProfile({ ...mon, heightM, weightKg }),
  profile: fixed,
  types,
  energy,
});
const post = {
  play: "post" as const,
  zone: "rim" as const,
  coverage: "man" as const,
};
const drive = {
  play: "isolation" as const,
  zone: "rim" as const,
  coverage: "man" as const,
};
describe("body and typing change the matchup even with identical skill ratings", () => {
  it("repeated pair lookups still use current energy and replaced type arrays", () => {
    const a = actor(1.5, 80, ["fire"]),
      d = actor(1.5, 80, ["grass"]);
    const fresh = matchupEdges(a, d);
    expect(fresh.type).toBe(1);
    expect(matchupEdges(a, d)).toEqual(fresh);
    a.energy = 25;
    expect(matchupEdges(a, d).quickness).toBeLessThan(fresh.quickness);
    a.types = ["water"];
    expect(matchupEdges(a, d).type).toBe(-1);
    d.types = ["fire"];
    expect(matchupEdges(a, d).type).toBe(1);
  });
  it("mass helps establish a post seal but makes the same player easier to beat off the dribble", () => {
    const light = actor(1.5, 20),
      heavy = actor(1.5, 400),
      guard = actor();
    expect(
      resolveBodyMatchup(heavy, guard, post, 0).advantageChance,
    ).toBeGreaterThan(
      resolveBodyMatchup(light, guard, post, 0).advantageChance,
    );
    expect(
      resolveBodyMatchup(guard, heavy, drive, 0).advantageChance,
    ).toBeGreaterThan(
      resolveBodyMatchup(guard, light, drive, 0).advantageChance,
    );
    expect(matchupPreference(heavy, guard, "post")).toBeGreaterThan(
      matchupPreference(light, guard, "post"),
    );
    expect(matchupPreference(light, guard, "isolation")).toBeGreaterThan(
      matchupPreference(heavy, guard, "isolation"),
    );
    expect(screenLeverage(heavy, guard)).toBeGreaterThan(
      screenLeverage(light, guard),
    );
    expect(heavy.body.workload).toBeGreaterThan(light.body.workload);
  });
  it("reach contests shots and controls short boards, while long boards reward mobility", () => {
    const small = actor(0.4),
      tall = actor(4),
      guard = actor();
    expect(
      resolveBodyMatchup(guard, tall, drive, 0.99).blockDelta,
    ).toBeGreaterThan(resolveBodyMatchup(guard, small, drive, 0.99).blockDelta);
    expect(
      resolveBodyMatchup(tall, guard, { ...post, zone: "mid" }, 0.99)
        .physicalLogOdds,
    ).toBeGreaterThan(
      resolveBodyMatchup(small, guard, { ...post, zone: "mid" }, 0.99)
        .physicalLogOdds,
    );
    expect(reboundBody(tall.body, false)).toBeGreaterThan(
      reboundBody(small.body, false),
    );
    expect(reboundBody(actor(1.5, 20).body, true)).toBeGreaterThan(
      reboundBody(actor(1.5, 400).body, true),
    );
  });
  it("type resistance changes the attack contest without an automatic stop; dual types choose one style", () => {
    const fire = actor(1.5, 80, ["fire"]),
      grass = actor(1.5, 80, ["grass"]),
      water = actor(1.5, 80, ["water"]);
    expect(
      resolveBodyMatchup(fire, grass, drive, 0.5).advantageChance,
    ).toBeGreaterThan(
      resolveBodyMatchup(fire, water, drive, 0.5).advantageChance,
    );
    expect(matchupPreference(fire, grass, "isolation")).toBeGreaterThan(
      matchupPreference(fire, water, "isolation"),
    );
    const immune = resolveBodyMatchup(
      actor(1.5, 80, ["electric"]),
      actor(1.5, 80, ["ground"]),
      drive,
      0,
    );
    expect(immune.advantageChance).toBeGreaterThan(0);
    expect(immune.won).toBe(true);
    expect(matchupEdges(actor(1.5, 80, ["fire", "water"]), grass).type).toBe(1);
  });
  it("help contains an advantage, screens improve separation and tired players lose leverage", () => {
    const a = actor(),
      d = actor(),
      screen = actor(2, 300),
      helper = actor(3, 300);
    const base = resolveBodyMatchup(a, d, drive, 0);
    expect(
      resolveBodyMatchup(a, d, { ...drive, helper }, 0).physicalLogOdds,
    ).toBeLessThan(base.physicalLogOdds);
    expect(
      resolveBodyMatchup(
        a,
        d,
        { ...drive, play: "pickRoll", screener: screen },
        0,
      ).advantageChance,
    ).toBeGreaterThan(
      resolveBodyMatchup(a, d, { ...drive, play: "pickRoll" }, 0)
        .advantageChance,
    );
    expect(
      resolveBodyMatchup(actor(1.5, 80, ["normal"], 25), d, drive, 0)
        .advantageChance,
    ).toBeLessThan(base.advantageChance);
    expect(resolveBodyMatchup(a, d, drive, 0.99).physicalLogOdds).toBeLessThan(
      base.physicalLogOdds,
    );
  });
  it("extreme catalog bodies and immunities stay bounded and finite", () => {
    const a = actor(1000, 100000, ["normal"]),
      d = actor(0.01, 0.01, ["ghost"]);
    for (const play of [
      "post",
      "isolation",
      "pickRoll",
      "spotUp",
      "transition",
    ] as const)
      for (const zone of ["rim", "mid", "three"] as const)
        for (const roll of [0, 0.99]) {
          const m = resolveBodyMatchup(a, d, { ...drive, play, zone }, roll);
          for (const key of [
            "advantageChance",
            "physicalLogOdds",
            "typeLogOdds",
            "turnoverDelta",
            "foulDelta",
            "blockDelta",
            "contestChance",
          ] as const)
            expect(Number.isFinite(m[key])).toBe(true);
          expect(m.advantageChance).toBeGreaterThanOrEqual(0.12);
          expect(m.advantageChance).toBeLessThanOrEqual(0.8);
          expect(Math.abs(m.physicalLogOdds)).toBeLessThanOrEqual(0.55);
          expect(Math.abs(m.typeLogOdds)).toBeLessThanOrEqual(0.24);
          expect(Math.abs(m.turnoverDelta)).toBeLessThanOrEqual(0.025);
        }
    expect(
      bodyProfile({ ...mon, heightM: NaN, weightKg: Infinity }).reach,
    ).toBeGreaterThanOrEqual(0);
  });
});

it("the preview averages won and contained outcomes without changing the input or adding RNG", () => {
  const a = actor(1.5, 20, ["fire"]),
    d = actor(2, 200, ["grass"]);
  const p = previewBodyShot(0.5, a, d, drive);
  expect(p.probability).toBeCloseTo(
    p.advantageChance * p.wonProbability +
      (1 - p.advantageChance) * p.containedProbability,
    12,
  );
  expect(0.5 + p.physicalChange + p.typeChange).toBeCloseTo(p.probability, 12);
  expect(p).toEqual(previewBodyShot(0.5, a, d, drive));
});
it("does not add abstract screen, help or kickout movement again after court positions resolve it", () => {
  const a = actor(),
    d = actor(),
    s = actor(1.5, 400),
    h = actor();
  const c = { ...drive, resolvedCourt: { separated: true } };
  const base = resolveBodyMatchup(a, d, c, 0.99);
  const screened = resolveBodyMatchup(
    a,
    d,
    { ...c, play: "pickRoll", screener: s, helper: h, kickout: true },
    0.99,
  );
  expect(screened.screen).toBe(0);
  expect(screened.physicalLogOdds).toBeCloseTo(base.physicalLogOdds, 10);
  expect(screened.won).toBe(true);
});
