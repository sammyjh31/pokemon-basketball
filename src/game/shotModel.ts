import { applyTypeShotEffect, typeShotEffect } from "./typeMatchups";
import { clamp } from "./ratings";
import type { PlayerProfile } from "./playerProfile";
import type { DefenseScheme, PlayType } from "./types";

export type ShotZone = "rim" | "mid" | "three";
export interface ShotContext {
  shooter: PlayerProfile;
  shooterTypes?: readonly string[];
  defenderTypes?: readonly string[];
  helpTypes?: readonly (readonly string[])[];
  defender: PlayerProfile;
  shooterHeight: number;
  defenderHeight: number;
  zone: ShotZone;
  play: PlayType;
  coverage: DefenseScheme;
  shooterEnergy?: number;
  defenderEnergy?: number;
  spacing?: number;
  protection?: number;
  passing?: number;
  screening?: number;
  roleFitPenalty?: number;
  home?: boolean;
  clutch?: boolean;
  defenseFirst?: boolean;
}
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Model 2: smooth bounded odds, shared by the simulator and matchup explorer.
 * Coefficients are game design choices, not a fit to real-world basketball data.
 * Percentage-point explanations apply in listed order; interacting effects
 * cannot be interpreted as independent causal contributions.
 */
export function evaluateShot(c: ShotContext) {
  const a = c.shooter.attributes,
    d = c.defender.attributes;
  const energy = clamp(c.shooterEnergy ?? 100),
    defenderEnergy = clamp(c.defenderEnergy ?? 100);
  const def = (n: number) => n * (0.72 + defenderEnergy * 0.0028);
  const rim = c.zone === "rim",
    three = c.zone === "three";
  const baseProbability = rim ? 0.545 : three ? 0.335 : 0.39;
  const shooting = rim ? a.finishing : three ? a.threePoint : a.midRange;
  const contest = def(rim ? d.interiorDefense : d.perimeterDefense);
  const size = Math.log(
    (1 + clamp(c.shooterHeight, 0.1, 3.5)) /
      (1 + clamp(c.defenderHeight, 0.1, 3.5)),
  );
  const coverage =
    c.coverage === "zone"
      ? rim
        ? -0.12
        : three
          ? 0.085
          : 0
      : c.coverage === "press"
        ? 0.045
        : c.coverage === "switch"
          ? (60 - c.defender.traits.switchability) * 0.0015
          : 0;
  const adjustments: [string, number][] = [
    ["Shooting skill", (shooting - 60) * (rim ? 0.017 : 0.016)],
    ["On-ball defense", -(contest - 60) * 0.008],
    ["Help at the rim", rim ? -((c.protection ?? 60) - 60) * 0.005 : 0],
    ["Teammate spacing", ((c.spacing ?? 55) - 55) * (rim ? 0.006 : 0.004)],
    [
      "Passing",
      c.passing === undefined
        ? 0
        : (c.passing - 50) * (c.play === "spotUp" ? 0.0035 : 0.002),
    ],
    [
      "Screens",
      c.play === "pickRoll"
        ? ((c.screening ?? 50) - 50) *
          0.003 *
          (c.coverage === "switch" ? 0.35 : 1)
        : 0,
    ],
    [
      "Physical matchup",
      (rim
        ? (a.strength - def(d.strength)) * 0.0025
        : (a.speed - def(d.speed)) * 0.0018) +
        clamp(size, -0.75, 0.75) * (rim ? 0.12 : three ? 0.015 : 0.05),
    ],
    [
      "Closeout",
      rim
        ? 0
        : -(c.defender.traits.closeout - 60) *
          (c.play === "spotUp" ? 0.003 : 0.0015),
    ],
    ["Coverage", coverage],
    [
      "Transition",
      c.play === "transition" ? 0.16 + (a.speed - def(d.speed)) * 0.002 : 0,
    ],
    ["Fatigue", -0.38 * ((100 - energy) / 100) ** 2],
    ["Position fit", -clamp(c.roleFitPenalty ?? 0, 0, 100) * 0.006],
    ["Defensive game plan", c.defenseFirst ? -0.055 : 0],
    ["Home court", c.home ? 0.045 : 0],
    ["Clutch composure", c.clutch ? (a.composure - 60) * 0.0025 : 0],
  ];
  let logOdds = Math.log(baseProbability / (1 - baseProbability)),
    previous = baseProbability;
  const factors = adjustments.map(([label, impact]) => {
    logOdds += impact;
    const probability = clamp(sigmoid(logOdds), 0.1, 0.88),
      change = probability - previous;
    previous = probability;
    return { label, change };
  });
  if (c.shooterTypes && c.defenderTypes) {
    const effect = typeShotEffect(
      c.shooterTypes,
      c.defenderTypes,
      c.zone,
      c.helpTypes,
    );
    const probability = clamp(
      applyTypeShotEffect(previous, effect.logOdds),
      0.1,
      0.88,
    );
    factors.push({ label: "Type matchup", change: probability - previous });
    previous = probability;
  }
  return { baseProbability, probability: previous, factors };
}
