import { reboundBody, type BodyProfile } from "./bodyMatchups";
import { clamp } from "./ratings";
import type { Tactic } from "./types";
export interface ReboundPlayer {
  abilityRebound?: number;
  id: string;
  body?: BodyProfile;
  offense: number;
  defense: number;
  strength: number;
  vertical: number;
  speed: number;
  passing: number;
  discipline: number;
}
export interface ReboundContext {
  zone: "rim" | "mid" | "three";
  tactic: Tactic;
  defenseTactic: Tactic;
  freeThrow?: boolean;
  /** Court version 3: flatter pursuit weights and saturating body bonuses. */
  balanced?: boolean;
  /** Game flow on court v2: zone defenders box out less reliably. */
  zoneDefense?: boolean;
}
/** Version 3 rebound weight exponent; version 1/2 square the pursuit value. */
export const BALANCED_REBOUND_EXPONENT = 1.3;
/** Version 3: loose balls also reach players who did not crash the glass. */
const BALANCED_NON_CRASHER_SHARE = 0.3;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const weighted = (weights: number[], random: () => number) => {
  let value = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    value -= weights[i];
    if (value <= 0 && weights[i] > 0) return i;
  }
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
  return 0;
};
/** Bounded tuning, not tracking data. The index pairs correspond to current court roles. */
export function resolveRebound(
  attack: ReboundPlayer[],
  defense: ReboundPlayer[],
  c: ReboundContext,
  random: () => number,
) {
  const crashers = c.freeThrow
    ? 2
    : c.tactic === "interior"
      ? 3
      : c.tactic === "pace" || c.tactic === "defense"
        ? 1
        : 2;
  const long = c.zone === "three" && !c.freeThrow;
  const pursuit = (p: ReboundPlayer, offense: boolean) =>
    ((offense ? p.offense : p.defense) * 0.6 +
      p.vertical * 0.15 +
      (long ? p.speed : p.strength) * 0.25 +
      (p.body ? reboundBody(p.body, long, c.balanced) : 0)) *
    (p.abilityRebound ?? 1);
  const power = c.balanced ? BALANCED_REBOUND_EXPONENT : 2;
  const candidates = attack
    .map((p, i) => ({ i, value: pursuit(p, true) }))
    .sort((a, b) => b.value - a.value || a.i - b.i)
    .slice(0, crashers)
    .map((p) => p.i);
  const boxOuts = defense.map(
    (d, i) =>
      candidates.includes(i) &&
      random() <
        clamp(
          0.48 +
            (d.strength - attack[i].strength) * 0.003 +
            (d.body && attack[i].body
              ? (d.body.mass - attack[i].body!.mass) * 0.08
              : 0) +
            (d.discipline - 60) * 0.002,
          0.18,
          0.8,
        ) *
          (c.zoneDefense ? 0.85 : 1),
  );
  const attackWeights = attack.map((p, i) =>
    candidates.includes(i)
      ? pursuit(p, true) ** power * (boxOuts[i] ? 0.65 : 1)
      : c.balanced
        ? pursuit(p, true) ** power * BALANCED_NON_CRASHER_SHARE
        : 0,
  );
  const defenseWeights = defense.map(
    (p, i) => pursuit(p, false) ** power * (boxOuts[i] ? 1.12 : 1),
  );
  const offensiveChance = clamp(
    (c.freeThrow ? 0.12 : 0.23) +
      (mean(candidates.map((i) => pursuit(attack[i], true))) -
        mean(defense.map((p) => pursuit(p, false)))) *
        0.002 +
      (crashers - 2) * 0.035 -
      boxOuts.filter(Boolean).length * 0.012,
    0.055,
    0.43,
  );
  const offensive = random() < offensiveChance;
  const winner = weighted(offensive ? attackWeights : defenseWeights, random);
  // A strong rebounder who can pass launches runners; crashing rivals leave fewer defenders back.
  const transitionEdge =
    offensive || c.freeThrow
      ? 0
      : clamp(
          0.42 +
            (defense[winner].passing - 60) * 0.004 +
            (mean(defense.map((p) => p.speed)) -
              mean(attack.map((p) => p.speed))) *
              0.003 +
            (crashers - 2) * 0.14 +
            (c.defenseTactic === "pace" ? 0.1 : 0),
          0.1,
          0.9,
        );
  return {
    offensive,
    winner,
    offensiveChance,
    attackWeights,
    defenseWeights,
    boxOuts,
    transitionEdge,
  };
}
export function creationChance(
  play: string,
  passing: number,
  disrupted: boolean,
) {
  const base =
    play === "spotUp"
      ? 0.88
      : play === "pickRoll"
        ? 0.73
        : play === "transition"
          ? 0.62
          : play === "post"
            ? 0.47
            : 0.3;
  return clamp((base * passing) / 70 - (disrupted ? 0.18 : 0), 0, 0.94);
}
