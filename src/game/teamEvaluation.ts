import { shinyPokemon } from "./shiny";
import { movesEnabled } from "./basketballMoves";
import { moveValue } from "./movePolicy";
import type { MoveTeam } from "./moveTypes";
import { masteryXp } from "./abilityMastery";
import { teamLeadership } from "./playerPersonality";
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
import {
  moraleProfile,
  moraleScores,
  moraleState,
  type MoraleRoster,
} from "./playerMorale";
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
import {
  chemistryEnabled,
  evaluateLineupChemistry,
  type ChemistryContext,
} from "./lineupChemistry";
import type { RotationPlan } from "./franchiseFeatures";
import type { PairBonds } from "./teammateChemistry";
export { abilityUsefulness } from "./abilityEvaluation";

/** Deliberately independent of consumers and save formats. Context is a fresh snapshot. */
export interface EvaluationTeam {
  shinySeed?: number;
  roster: Roster;
  tactic: Tactic;
  defense?: DefenseScheme;
  coach?: CoachAssignment;
  development?: PlayerDevelopment;
  abilityVersion?: 1;
  abilityMasteryVersion?: 1;
  movesetVersion?: import("./moveTypes").MovesetVersion;
  courtVersion?: import("./courtTypes").CourtVersion;
  abilityMastery?: Record<number, number>;
  physicalAbilityVersion?: 1;
  evaluationVersion?: 1;
  chemistryVersion?: 1;
  chemistryGrowthVersion?: 1;
  chemistryBonds?: PairBonds;
  moraleVersion?: 1;
  personalityVersion?: 1;
  morale?: MoraleRoster;
  rotationPlan?: RotationPlan;
  engineRules?: { abilities: boolean; familiarity?: number };
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
  shinySeed?: number;
  moves?: MoveTeam;
  tactic: Tactic;
  defense: DefenseScheme;
  abilities: boolean;
  physicalAbilities?: boolean;
  mastery?: Record<number, number>;
  development: PlayerDevelopment;
  morale?: Pick<EvaluationTeam, "roster" | "moraleVersion" | "morale">;
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
    const baseMon = POKEMON_BY_ID.get(team.roster[slot]!);
    const mon = baseMon ? shinyPokemon(baseMon, team.shinySeed) : undefined;
    return mon && !excludedSet.has(mon.id)
      ? [
          {
            slot,
            mon,
            p: moraleProfile(
              playerProfile(mon, team.development?.[mon.id]),
              team,
              mon.id,
            ),
          },
        ]
      : [];
  });
}

/** One immutable pregame snapshot serves every hypothetical unit and scheme. */
function projectedChemistryContext(
  team: EvaluationTeam,
): Omit<ChemistryContext, "tactic" | "defense"> | undefined {
  if (!chemistryEnabled(team)) return undefined;
  const leadership = teamLeadership(team);
  return {
    abilities: abilitiesEnabled(team),
    familiarity: team.engineRules?.familiarity,
    ...(leadership ? { leadership } : {}),
    ...(team.moraleVersion === 1 ? { morale: moraleScores(team) } : {}),
    ...(team.chemistryGrowthVersion === 1
      ? { bonds: team.chemistryBonds ?? {} }
      : {}),
  };
}

/** Four meaningful projected units at most; safe to reuse in market evaluations.
 * The expensive in-game subset search is deliberately confined to matchLineups.
 */
function projectedUnit(
  team: EvaluationTeam,
  players: ReturnType<typeof rosterProfiles>,
  tactic: Tactic,
  defense: DefenseScheme,
  sharedContext = projectedChemistryContext(team),
) {
  if (!sharedContext) return undefined;
  const active = team.rotationPlan
    ? players.filter(({ slot }) => team.rotationPlan!.minutes[slot] > 0)
    : players;
  const pool =
    active.length >= 5
      ? active
      : [
          ...active,
          ...players
            .filter((p) => !active.includes(p))
            .slice(0, 5 - active.length),
        ];
  if (pool.length < 5) return undefined;
  const scores = new Map(
    pool.map(
      (player) =>
        [
          player,
          POSITIONS.map(
            (role) =>
              player.p.positions[role] +
              offenseFit(player.p, tactic) * 0.1 +
              defenseFit(player.p, defense) * 0.1,
          ),
        ] as const,
    ),
  );
  const assign = (options: typeof pool) => {
    const unit: typeof pool = [];
    for (const role of [0, 4, 1, 3, 2]) {
      const best = options
        .filter((p) => !unit.includes(p))
        .sort((a, b) => scores.get(b)![role] - scores.get(a)![role])[0];
      unit[role] = best;
    }
    return unit;
  };
  const baseline = assign(pool);
  const candidates = [
    baseline,
    ...pool
      .filter((p) => !baseline.includes(p))
      .map((reserve) => {
        const replace = POSITIONS.map((_, role) => ({
          role,
          gain: scores.get(reserve)![role] - scores.get(baseline[role])![role],
        })).sort((a, b) => b.gain - a.gain)[0].role;
        return assign(
          baseline.map((p, role) => (role === replace ? reserve : p)),
        );
      }),
  ];
  return candidates
    .map((unit) => {
      const chemistry = evaluateLineupChemistry(
        unit.map(({ mon, p }) => ({ pokemonId: mon.id, profile: p })),
        { ...sharedContext, tactic, defense },
      );
      return {
        players: unit.map(({ mon }, role) => ({
          pokemonId: mon.id,
          role: POSITIONS[role],
        })),
        chemistry,
        score:
          mean(unit.map((p, role) => scores.get(p)![role])) + chemistry.value,
      };
    })
    .sort((a, b) => b.score - a.score)[0];
}

export function projectedLineupChemistry(
  team: EvaluationTeam,
  plan?: { tactic: Tactic; defense: DefenseScheme },
) {
  if (!chemistryEnabled(team)) return undefined;
  const scheme = plan ?? evaluationGamePlan(team);
  return projectedUnit(
    team,
    rosterProfiles(team),
    scheme.tactic,
    scheme.defense,
  );
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
    physical = physicalAbilitiesEnabled(team),
    sharedContext = projectedChemistryContext(team);
  const tactic = TACTICS.map((tactic) => ({
    tactic,
    score:
      mean(
        players.map(
          ({ mon, p }) =>
            offenseFit(p, tactic) +
            (movesEnabled(team) ? moveValue({ ...team, tactic }, mon.id) : 0) +
            (enabled
              ? abilityUsefulness(mon.id, p, masteryXp(team, mon.id)) *
                (speciesAbility(mon.id).tactics.includes(tactic) ? 4 : 1)
              : 0) +
            (physical
              ? physicalAbilityValue(
                  mon.id,
                  p,
                  tactic,
                  team.defense ?? "man",
                  p.bestPosition,
                  {},
                  masteryXp(team, mon.id),
                )
              : 0),
        ),
      ) +
      (tactic === coach.tactic ? 18 - 10 * coach.adaptability : 0) +
      (projectedUnit(
        team,
        players,
        tactic,
        team.defense ?? "man",
        sharedContext,
      )?.chemistry.value ?? 0),
  })).sort((a, b) => b.score - a.score)[0].tactic;
  const defense = DEFENSE_SCHEMES.map((defense) => ({
    defense,
    score:
      mean(
        players.map(
          ({ mon, p }) =>
            defenseFit(p, defense) +
            (physical
              ? physicalAbilityValue(
                  mon.id,
                  p,
                  tactic,
                  defense,
                  p.bestPosition,
                  {},
                  masteryXp(team, mon.id),
                )
              : 0),
        ),
      ) +
      (defense === coach.defense ? 18 - 10 * coach.adaptability : 0) +
      (projectedUnit(team, players, tactic, defense, sharedContext)?.chemistry
        .value ?? 0),
  })).sort((a, b) => b.score - a.score)[0].defense;
  return {
    tactic,
    defense,
    reason: `${coach.name}: shared roster evaluation favors ${tactic} offense and ${defense} defense, balancing coaching style, developed skills and enabled abilities.${physical ? " Physical movement, screens, rebounding and energy effects inform the plan." : ""}${chemistryEnabled(team) ? " Projected five-player chemistry and active partnerships inform the plan." : ""}${team.moraleVersion === 1 ? " Current morale supplies a bounded temporary execution adjustment." : ""}`,
  };
}
export function createEvaluationContext(
  team: EvaluationTeam,
  excludeIds: readonly number[] = [],
): EvaluationContext {
  const plan = evaluationGamePlan(team),
    players = rosterProfiles(team, excludeIds);
  return {
    ...(team.shinySeed !== undefined ? { shinySeed: team.shinySeed } : {}),
    tactic: plan.tactic,
    defense: plan.defense,
    abilities: abilitiesEnabled(team),
    ...(movesEnabled(team) ? { moves: structuredClone(team) } : {}),
    ...(team.abilityMasteryVersion === 1
      ? {
          mastery: Object.fromEntries(
            Object.values(team.roster).flatMap((id) =>
              id == null ? [] : [[id, masteryXp(team, id)]],
            ),
          ),
        }
      : {}),
    ...(physicalAbilitiesEnabled(team) ? { physicalAbilities: true } : {}),
    ...(team.moraleVersion === 1
      ? {
          morale: {
            roster: { ...team.roster },
            moraleVersion: 1 as const,
            morale: Object.fromEntries(
              Object.values(team.roster).flatMap((id) =>
                id === null ? [] : [[id, { ...moraleState(team, id) }]],
              ),
            ),
          },
        }
      : {}),
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
function evaluationValues(
  context: EvaluationContext,
  pokemonId: number,
  p: PlayerProfile,
  role?: Position,
  moves = context.moves
    ? moveValue(context.moves, pokemonId, p, context.mastery?.[pokemonId])
    : undefined,
) {
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
    ? abilityUsefulness(pokemonId, p, context.mastery?.[pokemonId]) *
      (speciesAbility(pokemonId).tactics.includes(context.tactic) ? 1 : 0.5)
    : 0;
  const physical = context.physicalAbilities
    ? physicalAbilityValue(
        pokemonId,
        p,
        context.tactic,
        context.defense,
        actualRole,
        context.needs,
        context.mastery?.[pokemonId],
      )
    : 0;
  // Preserve the report's addition order exactly, including optional factors.
  const contributions = [
    talent * 0.25,
    roleFit * 0.45,
    scheme * 0.25,
    needs * 0.05,
    ability * 4,
  ];
  if (moves !== undefined) contributions.push(moves);
  if (context.physicalAbilities) contributions.push(physical);
  return {
    actualRole,
    talent,
    roleFit,
    scheme,
    needs,
    ability,
    physical,
    moves,
    score: contributions.reduce((sum, value) => sum + value, 0),
  };
}
function scoreProfile(
  context: EvaluationContext,
  pokemonId: number,
  p: PlayerProfile,
  role?: Position,
): PlayerEvaluation {
  const {
    actualRole,
    talent,
    roleFit,
    scheme,
    needs,
    ability,
    physical,
    moves,
    score,
  } = evaluationValues(context, pokemonId, p, role);
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
  if (moves !== undefined)
    factors.push({
      key: "moves",
      label: "Coached basketball moves",
      value: moves,
      contribution: moves,
    });
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
    score,
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
/** The simulation needs the same final score, without allocating UI explanations. */
export function evaluatePlayerScore(
  context: EvaluationContext,
  pokemonId: number,
  role?: Position,
  offsets?: DevelopmentRatings,
): number {
  const mon = POKEMON_BY_ID.get(pokemonId);
  if (!mon) throw new Error("Cannot evaluate an unknown Pokémon.");
  const raw = playerProfile(
    shinyPokemon(mon, context.shinySeed),
    offsets ?? context.development[pokemonId],
  );
  const profile = context.morale
    ? moraleProfile(raw, context.morale, pokemonId)
    : raw;
  // The report selects the role from base talent before morale is applied.
  const actualRole =
    role ??
    POSITIONS.reduce((a, b) => (raw.positions[b] > raw.positions[a] ? b : a));
  return evaluationValues(context, pokemonId, profile, actualRole).score;
}
/** All positions share coached moves; role fit and physical effects still vary. */
export function evaluatePlayerScores(
  context: EvaluationContext,
  pokemonId: number,
): number[] {
  const mon = POKEMON_BY_ID.get(pokemonId);
  if (!mon) throw new Error("Cannot evaluate an unknown Pokémon.");
  const raw = playerProfile(
    shinyPokemon(mon, context.shinySeed),
    context.development[pokemonId],
  );
  const profile = context.morale
    ? moraleProfile(raw, context.morale, pokemonId)
    : raw;
  const moves = context.moves
    ? moveValue(context.moves, pokemonId, profile, context.mastery?.[pokemonId])
    : undefined;
  return POSITIONS.map(
    (role) => evaluationValues(context, pokemonId, profile, role, moves).score,
  );
}
export function evaluatePlayer(
  context: EvaluationContext,
  pokemonId: number,
  role?: Position,
  offsets?: DevelopmentRatings,
): PlayerEvaluation {
  const mon = POKEMON_BY_ID.get(pokemonId);
  if (!mon) throw new Error("Cannot evaluate an unknown Pokémon.");
  const raw = playerProfile(
    shinyPokemon(mon, context.shinySeed),
    offsets ?? context.development[pokemonId],
  );
  const base = scoreProfile(context, pokemonId, raw, role);
  if (!context.morale) return base;
  const effective = scoreProfile(
    context,
    pokemonId,
    moraleProfile(raw, context.morale, pokemonId),
    base.role,
  );
  const contribution = effective.score - base.score;
  return {
    ...base,
    score: effective.score,
    factors: [
      ...base.factors,
      {
        key: "morale",
        label: "Temporary morale execution",
        value: moraleState(context.morale, pokemonId).score,
        contribution,
      },
    ],
    reasons: [
      ...base.reasons,
      `Current morale adds ${contribution >= 0 ? "+" : ""}${contribution.toFixed(1)} temporary team-value points; base talent and permanent development stay unchanged.`,
    ],
  };
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
    ...(context.moves ? ["moves"] : []),
    ...(context.morale ? ["morale"] : []),
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
  const projected = projectedUnit(
    team,
    players,
    context.tactic,
    context.defense,
  );
  if (projected)
    factors.push({
      key: "chemistry",
      label: "Projected five-player chemistry",
      value: projected.chemistry.score,
      contribution: projected.chemistry.value,
    });
  return {
    score: factors.reduce((n, f) => n + f.contribution, 0),
    factors,
    players: evaluations,
    ...(projected?.chemistry.continuity
      ? { continuity: projected.chemistry.continuity }
      : {}),
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
      detail: `Shared evaluation: ${old.value.toFixed(1)} → ${f.value.toFixed(1)}.${
        f.key === "chemistry" && (a.continuity || b.continuity)
          ? ` Earned familiarity: ${(a.continuity?.score ?? 0).toFixed(1)} → ${(b.continuity?.score ?? 0).toFixed(1)} / 100; ${(a.continuity?.sharedMinutes ?? 0).toFixed(1)} → ${(b.continuity?.sharedMinutes ?? 0).toFixed(1)} average retained shared minutes for the projected five. New connections can grow through official games.`
          : ""
      }`,
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
  const chemistryPlayers = chemistryEnabled(team)
    ? rosterProfiles(team)
    : undefined;
  const chemistryBefore = chemistryPlayers
    ? (projectedUnit(team, chemistryPlayers, context.tactic, context.defense)
        ?.chemistry.value ?? 0)
    : 0;
  const current = playerProfile(
    shinyPokemon(POKEMON_BY_ID.get(pokemonId)!, team.shinySeed),
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
      const after = evaluatePlayer(context, pokemonId, before.role, projected);
      const chemistryAfter = chemistryPlayers
        ? (projectedUnit(
            team,
            chemistryPlayers.map((player) =>
              player.mon.id === pokemonId
                ? {
                    ...player,
                    p: moraleProfile(
                      playerProfile(player.mon, projected),
                      team,
                      player.mon.id,
                    ),
                  }
                : player,
            ),
            context.tactic,
            context.defense,
          )?.chemistry.value ?? 0)
        : 0;
      // Mastery practice is a separate, bounded opportunity. Its expected XP
      // follows the aligned focus while existing skill needs retain priority.
      const xp = masteryXp(team, pokemonId);
      const expectedXp =
        18 + (speciesAbility(pokemonId).training === focus ? 24 : 0);
      const masteryGain =
        team.abilityMasteryVersion === 1 && abilitiesEnabled(team)
          ? clamp(
              evaluatePlayer(
                {
                  ...context,
                  mastery: {
                    ...context.mastery,
                    [pokemonId]: Math.min(1000, xp + expectedXp),
                  },
                },
                pokemonId,
                before.role,
                projected,
              ).score - after.score,
              0,
              0.35,
            )
          : 0;
      const gain =
        after.score -
        before.score +
        chemistryAfter -
        chemistryBefore +
        masteryGain;
      return {
        focus,
        role: before.role,
        gain,
        reasons: [
          `Shared team value: ${gain >= 0 ? "+" : ""}${gain.toFixed(2)} projected from this practice focus; this is a planning estimate, not a promised rating gain.`,
          ...(team.abilityMasteryVersion === 1 && abilitiesEnabled(team)
            ? [
                `Ability mastery opportunity: +${masteryGain.toFixed(2)} projected team value from ${speciesAbility(pokemonId).training === focus ? "aligned" : "general"} practice, with ${Math.max(0, 1000 - xp).toFixed(0)} XP of headroom; recovery still limits workload.`,
              ]
            : []),
          ...before.reasons.slice(0, 2),
          ...(chemistryPlayers
            ? [
                "Practice value includes its effect on the projected five's chemistry and partnerships.",
              ]
            : []),
        ],
      };
    })
    .sort((a, b) => b.gain - a.gain);
}
