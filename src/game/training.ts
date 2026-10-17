import {
  TRAINING_FOCUSES,
  TRAINING_INTENSITIES,
  type PlayerTrainingPlan,
  type TrainingPlans,
} from "./franchiseFeatures";
import { DEVELOPMENT_SKILLS, type DevelopmentSkill } from "./developmentTypes";
import { POSITIONS, type Position, type Roster } from "./types";

export const TRAINING_FOCUS_LABELS: Record<
  PlayerTrainingPlan["focus"],
  string
> = {
  balanced: "Balanced",
  shooting: "Shooting",
  defense: "Defense",
  playmaking: "Playmaking",
  conditioning: "Conditioning",
  position: "Position practice",
};
export const TRAINING_INTENSITY_LABELS: Record<
  PlayerTrainingPlan["intensity"],
  string
> = {
  steady: "Steady · lower volatility",
  standard: "Standard · normal volatility",
  aggressive: "Aggressive · higher volatility",
};

export function validateTrainingPlans(
  value: unknown,
  roster: Roster,
): TrainingPlans {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Choose valid player training plans.");
  const owned = new Set(
    Object.values(roster)
      .filter((id) => id != null)
      .map(String),
  );
  const plans: TrainingPlans = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!owned.has(id) || !raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error(
        "Training plans must belong to players on your current roster.",
      );
    const plan = raw as Record<string, unknown>;
    if (
      Object.keys(plan).some(
        (key) => !["focus", "intensity", "position"].includes(key),
      ) ||
      !TRAINING_FOCUSES.includes(plan.focus as PlayerTrainingPlan["focus"]) ||
      !TRAINING_INTENSITIES.includes(
        plan.intensity as PlayerTrainingPlan["intensity"],
      ) ||
      (plan.focus === "position"
        ? !POSITIONS.includes(plan.position as Position)
        : plan.position !== undefined)
    )
      throw new Error("Choose a valid focus, intensity and target position.");
    plans[Number(id)] = {
      focus: plan.focus as PlayerTrainingPlan["focus"],
      intensity: plan.intensity as PlayerTrainingPlan["intensity"],
      ...(plan.focus === "position"
        ? { position: plan.position as Position }
        : {}),
    };
  }
  return plans;
}

export const FOCUS_SKILLS: Record<
  Exclude<PlayerTrainingPlan["focus"], "balanced" | "position">,
  DevelopmentSkill[]
> = {
  shooting: ["threePoint", "midRange", "freeThrow"],
  defense: [
    "perimeterDefense",
    "interiorDefense",
    "steal",
    "block",
    "defensiveRebound",
  ],
  playmaking: ["passing", "ballHandling", "composure"],
  conditioning: ["speed", "strength", "stamina", "vertical"],
};
export const POSITION_SKILLS: Record<Position, DevelopmentSkill[]> = {
  PG: ["passing", "ballHandling", "speed", "composure", "perimeterDefense"],
  SG: [
    "threePoint",
    "midRange",
    "ballHandling",
    "finishing",
    "perimeterDefense",
  ],
  SF: [
    "finishing",
    "threePoint",
    "perimeterDefense",
    "passing",
    "defensiveRebound",
  ],
  PF: [
    "finishing",
    "strength",
    "interiorDefense",
    "offensiveRebound",
    "defensiveRebound",
  ],
  C: [
    "interiorDefense",
    "block",
    "offensiveRebound",
    "defensiveRebound",
    "strength",
  ],
};

/** A fixed practice budget redirects growth, including a modest cost to general skills. */
export function trainingSkillAdjustment(
  plan: PlayerTrainingPlan,
  skill: DevelopmentSkill,
): number {
  if (plan.focus === "balanced") return 0;
  const skills =
    plan.focus === "position"
      ? POSITION_SKILLS[plan.position!]
      : FOCUS_SKILLS[plan.focus];
  return skills.includes(skill)
    ? 9 / skills.length
    : -10 / (DEVELOPMENT_SKILLS.length - skills.length);
}
