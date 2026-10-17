import { evaluationTrainingOptions } from "./teamEvaluation";
import { POKEMON_BY_ID } from "../data/pokemon";
import { abilitiesEnabled, speciesAbility } from "./abilities";
import {
  physicalAbilitiesEnabled,
  physicalAbilityDescription,
} from "./physicalAbilities";
import { coachAbilityFit } from "./coachPolicy";
import type { PlayerTrainingPlan } from "./franchiseFeatures";
import type { DevelopmentSkill } from "./developmentTypes";
import { playerProfile } from "./playerProfile";
import { moraleAssessment } from "./playerMorale";
import { ATTRIBUTE_LABELS } from "./ratings";
import { getCoach } from "./trainerCoaches";
import {
  FOCUS_SKILLS,
  POSITION_SKILLS,
  TRAINING_FOCUS_LABELS,
  validateTrainingPlans,
} from "./training";
import {
  ROSTER_SLOTS,
  type LeaguePlayer,
  type LeagueTeam,
  type Roster,
} from "./types";

export interface CoachTrainingAssignment {
  version: 1;
  coachId: string;
  plan: PlayerTrainingPlan;
  reasons: string[];
}
const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
type Focus = Exclude<PlayerTrainingPlan["focus"], "balanced">;

/** A pure preview and camp policy. No randomness, match inputs or saved plans are mutated. */
export function coachTrainingPlans(
  team: LeagueTeam,
  players: LeaguePlayer[] = [],
): Record<number, CoachTrainingAssignment> {
  const coach = getCoach(team.coach?.id ?? "");
  if (!coach) return {};
  const roster = ROSTER_SLOTS.flatMap((slot) => {
    const mon = POKEMON_BY_ID.get(team.roster[slot]!);
    if (!mon) return [];
    const profile = playerProfile(mon, team.development?.[mon.id]);
    // Trainers choose lineups dynamically; a player's strongest position is their camp role.
    return [{ mon, profile, role: profile.bestPosition }];
  });
  const teamAverage = (skills: DevelopmentSkill[]) =>
    mean(roster.map((p) => mean(skills.map((s) => p.profile.attributes[s]))));
  return Object.fromEntries(
    roster.map(({ mon, profile, role }) => {
      const a = profile.attributes;
      const species = abilitiesEnabled(team)
        ? speciesAbility(mon.id)
        : undefined;
      const abilityFit = species ? coachAbilityFit(mon.id, profile) : 0;
      const skillsFor = (focus: Focus) =>
        focus === "position" ? POSITION_SKILLS[role] : FOCUS_SKILLS[focus];
      const style: Record<Focus, number> = {
        shooting: coach.tactic === "perimeter" ? 19 : 0,
        defense:
          (coach.tactic === "defense" ? 19 : 0) +
          (coach.defense === "press" || coach.defense === "switch" ? 5 : 2),
        playmaking:
          coach.tactic === "balanced"
            ? 16
            : coach.tactic === "perimeter" || coach.tactic === "pace"
              ? 7
              : 0,
        conditioning:
          coach.tactic === "pace" ? 18 : coach.defense === "press" ? 8 : 0,
        position:
          coach.tactic === "interior" && (role === "PF" || role === "C")
            ? 20
            : 3,
      };
      const shared =
        team.evaluationVersion === 1
          ? evaluationTrainingOptions(team, mon.id, role)
          : undefined;
      const candidates = (Object.keys(style) as Focus[])
        .map((focus) => {
          const skills = skillsFor(focus);
          const ability = mean(skills.map((s) => a[s]));
          const need = Math.max(0, 70 - teamAverage(skills));
          const repairs = mean(skills.map((s) => Math.max(0, 65 - a[s])));
          const roleFit =
            skills.filter((s) => POSITION_SKILLS[role].includes(s)).length /
            skills.length;
          // Keep enough upside to avoid drilling capped skills. Role fit prevents irrelevant repairs.
          const headroom = mean(skills.map((s) => 100 - a[s]));
          // At most twelve points: an ability can break a close decision, while
          // urgent team needs, useful role repairs and capped skills still matter.
          const synergy =
            species?.training === focus
              ? 12 *
                (0.5 + abilityFit * 0.5) *
                Math.min(1, headroom / 30) *
                (0.8 + roleFit * 0.2) *
                (species.tactics.includes(coach.tactic) ? 1 : 0.9)
              : 0;
          const score =
            style[focus] * (1 - coach.adaptability * 0.45) +
            need * (0.65 + coach.adaptability * 1.1) +
            repairs * (0.35 + roleFit * 0.4) +
            ability * roleFit * 0.12 +
            roleFit * 8 +
            headroom * 0.12 +
            synergy;
          return {
            focus,
            skills,
            ability,
            need,
            score: shared ? shared.find((p) => p.focus === focus)!.gain : score,
          };
        })
        .sort((x, y) => y.score - x.score);
      const chosen = candidates[0];
      const season = players.find(
        (p) => p.teamId === team.id && p.pokemonId === mon.id,
      );
      const mpg =
        season && season.gamesPlayed > 0
          ? season.minutes / season.gamesPlayed
          : undefined;
      const morale =
        team.moraleVersion === 1 ? moraleAssessment(team, mon.id) : undefined;
      const moraleCare =
        !!morale &&
        (morale.score < 40 ||
          morale.recentMinutes >= 35 ||
          morale.minuteAdjustment < 0 ||
          morale.disruption < 0);
      const heavy = mpg !== undefined && mpg >= 35;
      const lowStamina = a.stamina < 52;
      const intensity: PlayerTrainingPlan["intensity"] =
        moraleCare ||
        heavy ||
        lowStamina ||
        coach.rest >= 0.75 ||
        coach.risk < 0.3
          ? "steady"
          : coach.risk >= 0.7 && coach.rest < 0.55
            ? "aggressive"
            : "standard";
      const strongest = [...chosen.skills].sort((x, y) => a[y] - a[x])[0];
      const weakest = [...chosen.skills].sort((x, y) => a[x] - a[y])[0];
      const focusName =
        chosen.focus === "position"
          ? `${role} position practice`
          : TRAINING_FOCUS_LABELS[chosen.focus].toLowerCase();
      const plan: PlayerTrainingPlan = {
        focus: chosen.focus,
        intensity,
        ...(chosen.focus === "position" ? { position: role } : {}),
      };
      const reasons = [
        `${coach.name}'s ${coach.style.toLowerCase()} philosophy favors ${focusName} for this ${role} role.`,
        `Build on ${ATTRIBUTE_LABELS[strongest].toLowerCase()} (${Math.round(a[strongest])}) while improving ${ATTRIBUTE_LABELS[weakest].toLowerCase()} (${Math.round(a[weakest])}); ${Math.round(chosen.ability)} average in this focus.`,
        chosen.need > 5
          ? `Team need: this skill group averages ${Math.round(teamAverage(chosen.skills))}; the roster needs more support here.`
          : `Team fit: this skill group averages ${Math.round(teamAverage(chosen.skills))}; reinforce a useful role in the rotation.`,
        moraleCare
          ? `Morale support: ${morale!.actionLabel}. Steady training supports confidence and recovery after ${morale!.recentMinutes.toFixed(1)} recent minutes per game; temporary execution is separate from permanent development.`
          : heavy
            ? `Steady workload after ${mpg!.toFixed(1)} minutes per game; reduce development volatility.`
            : lowStamina
              ? `Stamina ${Math.round(a.stamina)}: steady work limits volatility.`
              : `${intensity === "aggressive" ? "Aggressive work accepts larger gains or setbacks" : intensity === "steady" ? "Steady work reduces volatility" : "Standard work balances growth and volatility"}, following the coach's risk and rest preferences.`,
      ];
      if (shared) reasons.push(shared[0].reasons[0]);
      if (shared && physicalAbilitiesEnabled(team))
        reasons.push(
          `Physical basketball adaptation: ${physicalAbilityDescription(mon.id)} Projected practice gains include how developed skills use these effects in this role and scheme.`,
        );
      if (species)
        reasons.push(
          chosen.focus === species.training
            ? `${species.name}: ${species.description} ${focusName} develops the skills needed to use this ability in the ${role} role, with room for improvement.`
            : `${species.name}: ${species.description} Its ${TRAINING_FOCUS_LABELS[species.training].toLowerCase()} synergy was considered; current team needs, role fit and development headroom favor ${focusName}.`,
        );
      return [
        mon.id,
        {
          version: 1,
          coachId: coach.id,
          plan,
          reasons,
        } satisfies CoachTrainingAssignment,
      ];
    }),
  );
}

/** Metadata is optional on old reports; when present it must be valid and correctly attributed. */
export function validateCoachTraining(
  value: unknown,
  expectedCoach?: string | null,
): CoachTrainingAssignment {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid coach training report.");
  const raw = value as Record<string, unknown>;
  if (
    raw.version !== 1 ||
    typeof raw.coachId !== "string" ||
    !getCoach(raw.coachId) ||
    (expectedCoach !== undefined && raw.coachId !== expectedCoach) ||
    Object.keys(raw).some(
      (k) => !["version", "coachId", "plan", "reasons"].includes(k),
    ) ||
    !Array.isArray(raw.reasons) ||
    !raw.reasons.length ||
    raw.reasons.length > 8 ||
    raw.reasons.some(
      (r) => typeof r !== "string" || !r.trim() || r.length > 500,
    )
  )
    throw new Error("Invalid coach training report.");
  const roster = Object.fromEntries(
    ROSTER_SLOTS.map((slot, i) => [slot, i === 0 ? 1 : null]),
  ) as Roster;
  const plan = validateTrainingPlans({ 1: raw.plan }, roster)[1]!;
  return {
    version: 1,
    coachId: raw.coachId,
    plan,
    reasons: [...raw.reasons] as string[],
  };
}
