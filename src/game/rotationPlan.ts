import type { PlayerDevelopment } from "./developmentTypes";
import type { RotationPlan } from "./franchiseFeatures";
import { rotationMinutes } from "./ratings";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type Roster,
  type RosterSlot,
  type RotationStyle,
} from "./types";

export function validateRotationPlan(value: unknown): RotationPlan {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Choose a valid rotation plan.");
  const plan = value as Record<string, unknown>;
  if (
    !plan.minutes ||
    typeof plan.minutes !== "object" ||
    Array.isArray(plan.minutes)
  )
    throw new Error("Set minutes for all eight roster slots.");
  const minutes = plan.minutes as Record<string, unknown>;
  if (
    Object.keys(minutes).length !== ROSTER_SLOTS.length ||
    ROSTER_SLOTS.some(
      (slot) =>
        !Object.hasOwn(minutes, slot) ||
        !Number.isInteger(minutes[slot]) ||
        Number(minutes[slot]) < 0 ||
        Number(minutes[slot]) > 48,
    )
  )
    throw new Error(
      "Each of the eight players needs an integer target from 0 to 48 minutes.",
    );
  if (
    ROSTER_SLOTS.reduce((sum, slot) => sum + Number(minutes[slot]), 0) !== 240
  )
    throw new Error("Target minutes must total exactly 240.");
  if (
    !Array.isArray(plan.closing) ||
    plan.closing.length !== 5 ||
    new Set(plan.closing).size !== 5 ||
    plan.closing.some(
      (slot) => !ROSTER_SLOTS.includes(slot) || Number(minutes[slot]) <= 0,
    )
  )
    throw new Error(
      "Choose five different closing players with positive target minutes.",
    );
  return {
    minutes: Object.fromEntries(
      ROSTER_SLOTS.map((slot) => [slot, minutes[slot]]),
    ) as Record<RosterSlot, number>,
    closing: [...plan.closing] as RosterSlot[],
  };
}

/** Start a custom plan from the existing automatic allocation for a complete roster. */
export function defaultRotationPlan(
  roster: Roster,
  rotation: RotationStyle = "balanced",
  development?: PlayerDevelopment,
): RotationPlan {
  const minutes = rotationMinutes(roster, rotation, development);
  const closing = [
    ...POSITIONS,
    ...ROSTER_SLOTS.filter(
      (slot) => !POSITIONS.includes(slot as (typeof POSITIONS)[number]),
    ),
  ]
    .filter((slot) => minutes[slot] > 0)
    .slice(0, 5);
  return { minutes, closing };
}
