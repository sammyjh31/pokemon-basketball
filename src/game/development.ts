import { POKEMON_BY_ID } from "../data/pokemon";
import { attributes, clamp, positionRating } from "./ratings";
import { nextRandom } from "./random";
import { playerImpact } from "./leagueStats";
import {
  DEVELOPMENT_SKILLS,
  DEVELOPMENT_MIN,
  DEVELOPMENT_MAX,
  DEVELOPMENT_YEAR_MIN,
  DEVELOPMENT_YEAR_MAX,
  type DevelopmentRatings,
  type DevelopmentSkill,
  type PlayerDevelopmentChange,
} from "./developmentTypes";
import { POSITIONS, type LeaguePlayer } from "./types";
import type { PlayerTrainingPlan } from "./franchiseFeatures";
import { TRAINING_FOCUS_LABELS, trainingSkillAdjustment } from "./training";
const rounded = (n: number) => Math.round(n * 10) / 10;
/**
 * Court version 3 development. Version 1/2 gave every regular a flat minutes bonus and
 * a weak pull back to the species foundation, so the league's rating spread nearly
 * doubled over eight seasons. These keep the user's requested volatility per skill
 * while holding the spread roughly stable.
 */
const BALANCED = {
  /** An eight-player rotation averages 30 minutes, so this term is zero-sum per club. */
  averageMinutes: 30,
  minutesScale: 18,
  opportunity: 1,
  /** Share of current offsets removed each year (version 1/2: 1/10). */
  regression: 1 / 4,
  /** Rating pull toward the league's average best-position rating of 57. */
  leagueRating: 57,
  parity: 0.08,
  parityMin: -1,
  parityMax: 2,
  /** Camp form shared by all skills; the per-skill noise is unchanged. */
  sharedForm: 0.75,
};

/** A species/year seed makes form repeatable and independent of roster ordering. */
export function developPlayer(
  player: LeaguePlayer,
  previous: DevelopmentRatings,
  year: number,
  seasonSeed: number,
  plan?: PlayerTrainingPlan,
  balanced = false,
): PlayerDevelopmentChange {
  const mon = POKEMON_BY_ID.get(player.pokemonId)!;
  const a = attributes(mon, previous);
  let seed =
    (seasonSeed ^
      Math.imul(player.pokemonId, 0x45d9f3b) ^
      Math.imul(year, 0x27d4eb2d)) >>>
    0;
  const roll = () => {
    const next = nextRandom(seed);
    seed = next.seed;
    return next.value;
  };
  const minutesPerGame = player.minutes / Math.max(1, player.gamesPlayed);
  const per36 = (n: number) =>
    player.minutes > 0 ? (n * 36) / player.minutes : 0;
  // playerImpact is already per game; convert using per-game minutes.
  const impactPer36 =
    minutesPerGame > 0 ? (playerImpact(player) * 36) / minutesPerGame : 0;
  const before = Math.max(
    ...POSITIONS.map((p) => positionRating(mon, p, previous)),
  );
  // Shrink small samples so a tiny reserve cameo cannot guarantee a breakout.
  const reliability = Math.min(1, player.minutes / 1200);
  const opportunity = balanced
    ? clamp(
        (minutesPerGame - BALANCED.averageMinutes) / BALANCED.minutesScale,
        -1,
        1,
      ) * BALANCED.opportunity
    : clamp((minutesPerGame - 22) / 14, -1, 1) * 2.4;
  const parity = balanced
    ? clamp(
        (before - BALANCED.leagueRating) * BALANCED.parity,
        BALANCED.parityMin,
        BALANCED.parityMax,
      )
    : 0;
  const production =
    clamp((impactPer36 - (before * 0.75 - 12)) / 16, -1, 1) * 3 * reliability;
  const formRoll = roll();
  const form =
    formRoll < 0.35
      ? 4 + roll() * 4
      : formRoll < 0.7
        ? -4 - roll() * 4
        : (roll() - 0.5) * 4;
  const tsAttempts = player.fga + 0.44 * player.fta;
  const ts = tsAttempts > 0 ? player.points / (2 * tsAttempts) : 0;
  const touch =
    clamp((ts - (0.42 + a.shooting * 0.0025)) * 18, -2.5, 2.5) *
    Math.min(1, tsAttempts / 500);
  const shooting = (made: number, attempts: number, expected: number) =>
    attempts > 0
      ? clamp((made / attempts - expected) * 15, -3, 3) *
        Math.min(1, attempts / 150)
      : 0;
  const skillEvidence: Partial<Record<DevelopmentSkill, number>> = {
    threePoint: shooting(
      player.threePM,
      player.threePA,
      0.2 + a.threePoint * 0.0027,
    ),
    midRange: shooting(
      player.midFgm,
      player.midFga,
      0.28 + a.midRange * 0.0025,
    ),
    freeThrow: shooting(player.ftm, player.fta, 0.48 + a.freeThrow * 0.004),
    finishing: shooting(
      player.rimFgm,
      player.rimFga,
      0.39 + a.finishing * 0.003,
    ),
    passing:
      clamp((per36(player.assists) - a.passing / 14) / 2, -2, 2) * reliability,
    ballHandling:
      clamp((2.8 - per36(player.turnovers)) / 1.5, -2, 2) * reliability,
    composure:
      (touch +
        clamp((2.8 - per36(player.turnovers)) / 2, -2, 2) * reliability) /
      2,
    steal:
      clamp((per36(player.steals) - a.steal / 48) * 2, -2, 2) * reliability,
    block:
      clamp((per36(player.blocks) - a.block / 100) * 2, -2, 2) * reliability,
    perimeterDefense:
      clamp((per36(player.steals) - 1.3) * 1.4, -2, 2) * reliability,
    interiorDefense:
      clamp((per36(player.blocks) - 0.6) * 1.4, -2, 2) * reliability,
    offensiveRebound:
      clamp(per36(player.offensiveRebounds) - a.offensiveRebound / 22, -2, 2) *
      reliability,
    defensiveRebound:
      clamp(
        (per36(player.defensiveRebounds) - a.defensiveRebound / 11) / 2,
        -2,
        2,
      ) * reliability,
    stamina: minutesPerGame > 36 ? -2 : minutesPerGame >= 22 ? 1.5 : -1,
  };
  const changes: DevelopmentRatings = {},
    next: DevelopmentRatings = { ...previous };
  for (const skill of DEVELOPMENT_SKILLS) {
    const current = previous[skill] ?? 0;
    // Development regresses toward a species' foundation instead of inflating forever.
    let projected =
      opportunity +
      production +
      form * (balanced ? BALANCED.sharedForm : 1) +
      (skillEvidence[skill] ?? touch * 0.25) -
      (balanced ? current * BALANCED.regression : current / 10) -
      parity +
      (roll() - 0.5) * 3;
    if (plan && (plan.focus !== "balanced" || plan.intensity !== "standard")) {
      // Reuse the same random draws so plan comparisons hold the player's camp constant.
      const formScale =
        plan.intensity === "steady"
          ? 0.65
          : plan.intensity === "aggressive"
            ? 1.35
            : 1;
      projected +=
        form * (formScale - 1) + trainingSkillAdjustment(plan, skill);
    }
    const change = Math.round(
      clamp(projected, DEVELOPMENT_YEAR_MIN, DEVELOPMENT_YEAR_MAX),
    );
    const updated = clamp(current + change, DEVELOPMENT_MIN, DEVELOPMENT_MAX);
    if (updated !== current) changes[skill] = updated - current;
    if (updated) next[skill] = updated;
    else delete next[skill];
  }
  const after = Math.max(...POSITIONS.map((p) => positionRating(mon, p, next)));
  const difference = after - before;
  const reasons = [
    minutesPerGame >= 28
      ? "Heavy rotation minutes provided sustained development opportunities."
      : minutesPerGame < 16
        ? "Limited playing time slowed development and made skills harder to maintain."
        : "Regular rotation minutes provided steady practice under game pressure.",
    production > 0.75
      ? "Production per minute exceeded expectations for the player's current ability."
      : production < -0.75
        ? "Production per minute fell below expectations for the player's current ability."
        : "Per-minute production was close to expectations for the player's current ability.",
    formRoll < 0.35
      ? "A breakout training camp boosted several skills."
      : formRoll < 0.7
        ? "A difficult training camp caused a broad form slump."
        : "An uneven training camp produced smaller skill-specific surprises.",
  ];
  if (minutesPerGame > 36)
    reasons.push("A heavy workload put extra pressure on conditioning.");
  if (plan?.focus && plan.focus !== "balanced")
    reasons.push(
      `${TRAINING_FOCUS_LABELS[plan.focus]}${plan.focus === "position" ? ` at ${plan.position}` : ""} redirected practice toward selected skills at the cost of general development.`,
    );
  if (plan?.intensity === "steady")
    reasons.push(
      "Steady training reduced camp volatility, limiting both breakouts and slumps.",
    );
  if (plan?.intensity === "aggressive")
    reasons.push(
      "Aggressive training increased camp volatility: larger gains come with greater risk of decline.",
    );
  return {
    pokemonId: player.pokemonId,
    teamId: player.teamId,
    before: rounded(before),
    after: rounded(after),
    minutesPerGame: rounded(minutesPerGame),
    impactPer36: rounded(impactPer36),
    changes,
    outcome:
      difference >= 4
        ? "breakout"
        : difference > 0.5
          ? "growth"
          : difference <= -4
            ? "slump"
            : difference < -0.5
              ? "decline"
              : "steady",
    reasons,
  };
}
