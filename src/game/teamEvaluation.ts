import { POKEMON_BY_ID } from "../data/pokemon";
import { abilitiesEnabled, speciesAbility } from "./abilities";
import {
  DEVELOPMENT_MAX,
  DEVELOPMENT_MIN,
  DEVELOPMENT_SKILLS,
  type DevelopmentRatings,
  type PlayerDevelopment,
} from "./developmentTypes";
import type { PlayerTrainingPlan } from "./franchiseFeatures";
import { playerProfile, type PlayerProfile } from "./playerProfile";
import { clamp } from "./ratings";
import { getCoach, type CoachAssignment } from "./trainerCoaches";
import { trainingSkillAdjustment } from "./training";
import {
  DEFENSE_SCHEMES,
  POSITIONS,
  ROSTER_SLOTS,
  TACTICS,
  type DefenseScheme,
  type Position,
  type Roster,
  type Tactic,
} from "./types";
import { abilityUsefulness } from "./abilityEvaluation";
import { physicalAbilitiesEnabled } from "./physicalAbilities";
import { physicalAbilityValue } from "./physicalAbilityEvaluation";
export { abilityUsefulness } from "./abilityEvaluation";

/** Deliberately independent of consumers and save formats. Context is a fresh snapshot. */
export interface EvaluationTeam {
  roster: Roster;
  tactic: Tactic;
  defense?: DefenseScheme;
  coach?: CoachAssignment;
  development?: PlayerDevelopment;
  abilityVersion?: 1;
  physicalAbilityVersion?: 1;
  evaluationVersion?: 1;
  engineRules?: { abilities: boolean };
}
const NEED_SKILLS = [
  "threePoint",
  "passing",
  "perimeterDefense",
  "interiorDefense",
  "defensiveRebound",
  "stamina",
] as const;
type NeedSkill = (typeof NEED_SKILLS)[number];
export interface EvaluationContext {
  tactic: Tactic;
  defense: DefenseScheme;
  abilities: boolean;
  physicalAbilities?: boolean;
  development: PlayerDevelopment;
  needs: Record<NeedSkill, { average: number; weight: number }>;
}
export interface EvaluationFactor {
  key: string;
  label: string;
  value: number;
  contribution: number;
}
export interface PlayerEvaluation {
  pokemonId: number;
  role: Position;
  talent: number;
  roleFit: number;
  score: number;
  factors: EvaluationFactor[];
  reasons: string[];
}
const mean = (xs: number[], fallback = 60) =>
  xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : fallback;

/** One definition for recruiting, game plans and substitutions. */
export function offenseFit(p: PlayerProfile, tactic: Tactic): number {
  const a = p.attributes;
  switch (tactic) {
    case "pace":
      return (a.speed + a.stamina + a.ballHandling) / 3;
    case "perimeter":
      return (a.threePoint * 2 + a.passing + p.traits.offBall) / 4;
    case "interior":
      return (a.finishing + a.strength + a.rebounding + p.traits.screening) / 4;
    case "defense":
      return (a.perimeterDefense + a.interiorDefense + a.defensiveRebound) / 3;
    default:
      return (a.passing + a.composure + a.finishing + a.threePoint) / 4;
  }
}
export function defenseFit(p: PlayerProfile, defense: DefenseScheme): number {
  const a = p.attributes;
  switch (defense) {
    case "zone":
      return (a.interiorDefense + a.block + a.defensiveRebound) / 3;
    case "press":
      return (a.steal + a.speed + a.stamina + p.traits.discipline) / 4;
    case "switch":
      return (
        (p.traits.switchability + a.perimeterDefense + a.interiorDefense) / 3
      );
    default:
      return (a.perimeterDefense + a.interiorDefense + p.traits.discipline) / 3;
  }
}
function rosterProfiles(
  team: EvaluationTeam,
  excluded: readonly number[] = [],
) {
  const excludedSet = new Set(excluded);
  return ROSTER_SLOTS.flatMap((slot) => {
    const mon = POKEMON_BY_ID.get(team.roster[slot]!);
    return mon && !excludedSet.has(mon.id)
      ? [{ slot, mon, p: playerProfile(mon, team.development?.[mon.id]) }]
      : [];
  });
}
export function evaluationGamePlan(team: EvaluationTeam) {
  const coach = getCoach(team.coach?.id ?? "");
  if (!coach)
    return {
      tactic: team.tactic,
      defense: team.defense ?? "man",
      reason: "Team instructions inform the shared evaluation.",
    };
  const players = rosterProfiles(team),
    enabled = abilitiesEnabled(team),
    physical = physicalAbilitiesEnabled(team);
  const tactic = TACTICS.map((tactic) => ({
    tactic,
    score:
      mean(
        players.map(
          ({ mon, p }) =>
            offenseFit(p, tactic) +
            (enabled
              ? abilityUsefulness(mon.id, p) *
                (speciesAbility(mon.id).tactics.includes(tactic) ? 4 : 1)
              : 0) +
            (physical
              ? physicalAbilityValue(mon.id, p, tactic, team.defense ?? "man")
              : 0),
        ),
      ) + (tactic === coach.tactic ? 18 - 10 * coach.adaptability : 0),
  })).sort((a, b) => b.score - a.score)[0].tactic;
  const defense = DEFENSE_SCHEMES.map((defense) => ({
    defense,
    score:
      mean(
        players.map(
          ({ mon, p }) =>
            defenseFit(p, defense) +
            (physical ? physicalAbilityValue(mon.id, p, tactic, defense) : 0),
        ),
      ) + (defense === coach.defense ? 18 - 10 * coach.adaptability : 0),
  })).sort((a, b) => b.score - a.score)[0].defense;
  return {
    tactic,
    defense,
    reason: `${coach.name}: shared roster evaluation favors ${tactic} offense and ${defense} defense, balancing coaching style, developed skills and enabled abilities.${physical ? " Physical movement, screens, rebounding and energy effects inform the plan." : ""}`,
  };
}
export function createEvaluationContext(
  team: EvaluationTeam,
  excludeIds: readonly number[] = [],
): EvaluationContext {
  const plan = evaluationGamePlan(team),
    players = rosterProfiles(team, excludeIds);
  return {
    tactic: plan.tactic,
    defense: plan.defense,
    abilities: abilitiesEnabled(team),
    ...(physicalAbilitiesEnabled(team) ? { physicalAbilities: true } : {}),
    development: Object.fromEntries(
      Object.entries(team.development ?? {}).map(([id, offsets]) => [
        id,
        { ...offsets },
      ]),
    ),
    needs: Object.fromEntries(
      NEED_SKILLS.map((key) => {
        const average = mean(players.map(({ p }) => p.attributes[key]));
        return [key, { average, weight: clamp((70 - average) / 30, 0, 1) }];
      }),
    ) as EvaluationContext["needs"],
  };
}
function scoreProfile(
  context: EvaluationContext,
  pokemonId: number,
  p: PlayerProfile,
  role?: Position,
): PlayerEvaluation {
  const best = POSITIONS.reduce((a, b) =>
    p.positions[b] > p.positions[a] ? b : a,
  );
  const actualRole = role ?? best,
    talent = p.positions[best],
    roleFit = p.positions[actualRole];
  const scheme =
    offenseFit(p, context.tactic) * 0.65 +
    defenseFit(p, context.defense) * 0.35;
  // Continuous contribution avoids a dead zone where a good shooter on a weak
  // shooting roster receives no credit for further improvement.
  const needs =
    mean(
      NEED_SKILLS.map(
        (key) =>
          context.needs[key].weight * clamp(p.attributes[key] / 100, 0, 1),
      ),
      0,
    ) * 100;
  const ability = context.abilities
    ? abilityUsefulness(pokemonId, p) *
      (speciesAbility(pokemonId).tactics.includes(context.tactic) ? 1 : 0.5)
    : 0;
  const factors: EvaluationFactor[] = [
    {
      key: "talent",
      label: "Basketball talent",
      value: talent,
      contribution: talent * 0.25,
    },
    {
      key: "role",
      label: `Role fit (${actualRole})`,
      value: roleFit,
      contribution: roleFit * 0.45,
    },
    {
      key: "scheme",
      label: "Coach and scheme fit",
      value: scheme,
      contribution: scheme * 0.25,
    },
    {
      key: "needs",
      label: "Roster needs",
      value: needs,
      contribution: needs * 0.05,
    },
    {
      key: "ability",
      label: "Ability usefulness",
      value: ability * 100,
      contribution: ability * 4,
    },
  ];
  const physical = context.physicalAbilities
    ? physicalAbilityValue(
        pokemonId,
        p,
        context.tactic,
        context.defense,
        actualRole,
        context.needs,
      )
    : 0;
  if (context.physicalAbilities)
    factors.push({
      key: "physical",
      label: "Physical ability fit",
      value: physical * 25,
      contribution: physical,
    });
  return {
    pokemonId,
    role: actualRole,
    talent,
    roleFit,
    score: factors.reduce((n, f) => n + f.contribution, 0),
    factors,
    reasons: [
      `${actualRole} role: ${roleFit.toFixed(1)}; basketball talent: ${talent.toFixed(1)}.`,
      `${context.tactic} offense / ${context.defense} defense: ${scheme.toFixed(1)} scheme fit.`,
      `Roster needs add ${(needs * 0.05).toFixed(1)} team-value points.`,
      context.abilities
        ? `${speciesAbility(pokemonId).name} adds ${(ability * 4).toFixed(1)} team-value points for likely usefulness.`
        : "Abilities are disabled for this league.",
      ...(context.physicalAbilities
        ? [
            `Physical effects add ${physical.toFixed(1)} team-value points from developed skills, role, scheme and roster needs.`,
          ]
        : []),
    ],
  };
}
export function evaluatePlayer(
  context: EvaluationContext,
  pokemonId: number,
  role?: Position,
  offsets?: DevelopmentRatings,
): PlayerEvaluation {
  const mon = POKEMON_BY_ID.get(pokemonId);
  if (!mon) throw new Error("Cannot evaluate an unknown Pokémon.");
  return scoreProfile(
    context,
    pokemonId,
    playerProfile(mon, offsets ?? context.development[pokemonId]),
    role,
  );
}
export function evaluateTeam(team: EvaluationTeam) {
  const context = createEvaluationContext(team),
    players = rosterProfiles(team);
  const evaluations = players.map(({ slot, mon }) =>
    evaluatePlayer(
      context,
      mon.id,
      POSITIONS.includes(slot as Position) ? (slot as Position) : undefined,
    ),
  );
  const keys = [
    "talent",
    "role",
    "scheme",
    "needs",
    "ability",
    ...(context.physicalAbilities ? ["physical"] : []),
  ];
  const factors: EvaluationFactor[] = keys.map((key) => ({
    key,
    label:
      key === "role"
        ? "Rotation role fit"
        : (evaluations[0]?.factors.find((f) => f.key === key)?.label ?? key),
    value: mean(
      evaluations.map((p) => p.factors.find((f) => f.key === key)!.value),
      0,
    ),
    contribution:
      mean(
        evaluations.map(
          (p) => p.factors.find((f) => f.key === key)!.contribution,
        ),
        0,
      ) * 0.85,
  }));
  // Coverage needs a second option at each position, not eight identical scorers.
  const depth = mean(
    POSITIONS.map((role) => {
      const fits = players
        .map(({ p }) => p.positions[role])
        .sort((a, b) => b - a);
      return (fits[0] ?? 0) * 0.4 + (fits[1] ?? 0) * 0.6;
    }),
    0,
  );
  factors.push({
    key: "depth",
    label: "Positional depth",
    value: depth,
    contribution: depth * 0.15,
  });
  return {
    score: factors.reduce((n, f) => n + f.contribution, 0),
    factors,
    players: evaluations,
  };
}
export function compareTeamEvaluation(
  before: EvaluationTeam,
  after: EvaluationTeam,
) {
  const a = evaluateTeam(before),
    b = evaluateTeam(after);
  const factors = [
    ...b.factors,
    ...a.factors
      .filter((old) => !b.factors.some((next) => next.key === old.key))
      .map((old) => ({ ...old, value: 0, contribution: 0 })),
  ].map((f) => {
    const old = a.factors.find((x) => x.key === f.key) ?? {
      value: 0,
      contribution: 0,
    };
    return {
      label: f.label,
      change: f.value - old.value,
      contribution: f.contribution - old.contribution,
      detail: `Shared evaluation: ${old.value.toFixed(1)} → ${f.value.toFixed(1)}.`,
    };
  });
  return { before: a.score, after: b.score, delta: b.score - a.score, factors };
}
export function evaluationTrainingOptions(
  team: EvaluationTeam,
  pokemonId: number,
  role?: Position,
) {
  const context = createEvaluationContext(team, [pokemonId]);
  const before = evaluatePlayer(context, pokemonId, role),
    offsets = team.development?.[pokemonId] ?? {};
  const current = playerProfile(
    POKEMON_BY_ID.get(pokemonId)!,
    offsets,
  ).attributes;
  const focuses = [
    "shooting",
    "defense",
    "playmaking",
    "conditioning",
    "position",
  ] as const;
  return focuses
    .map((focus) => {
      const plan: PlayerTrainingPlan = {
        focus,
        intensity: "standard",
        ...(focus === "position" ? { position: before.role } : {}),
      };
      // Fixed practice budget and development opportunity cost. Headroom limits
      // attainable improvement: drilling an already elite skill has less upside.
      const projected = Object.fromEntries(
        DEVELOPMENT_SKILLS.map((skill) => [
          skill,
          clamp(
            (offsets[skill] ?? 0) +
              trainingSkillAdjustment(plan, skill) *
                2 *
                (trainingSkillAdjustment(plan, skill) > 0
                  ? clamp((100 - current[skill]) / 35, 0, 1.8)
                  : 1),
            DEVELOPMENT_MIN,
            DEVELOPMENT_MAX,
          ),
        ]),
      ) as DevelopmentRatings;
      const after = evaluatePlayer(context, pokemonId, before.role, projected),
        gain = after.score - before.score;
      return {
        focus,
        role: before.role,
        gain,
        reasons: [
          `Shared team value: ${gain >= 0 ? "+" : ""}${gain.toFixed(2)} projected from this practice focus; this is a planning estimate, not a promised rating gain.`,
          ...before.reasons.slice(0, 2),
        ],
      };
    })
    .sort((a, b) => b.gain - a.gain);
}
