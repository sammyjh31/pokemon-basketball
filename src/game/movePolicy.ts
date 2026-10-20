import { POKEMON_BY_ID } from "../data/pokemon";
import { movePool, movesEnabled } from "./basketballMoves";
import { playerProfile, type PlayerProfile } from "./playerProfile";
import { getCoach } from "./trainerCoaches";
import { comboValue } from "./comboPolicy";
import type {
  BasketballMove,
  MoveAssignment,
  MoveTeam,
  Specialization,
} from "./moveTypes";
export const specializationRules = {
  fundamentals: {
    name: "Fundamentals",
    strength: 1,
    cost: 1,
    cooldown: 1,
    description: "Learn the basics; specialization unlocks at 75 XP.",
  },
  power: {
    name: "Power",
    strength: 1.25,
    cost: 1.35,
    cooldown: 1.2,
    description: "Stronger effects; 35% more energy and 20% longer recharge.",
  },
  control: {
    name: "Control",
    strength: 1.08,
    cost: 1.05,
    cooldown: 1,
    description:
      "Favors passing, screens and defensive timing; modest extra energy cost.",
  },
  efficiency: {
    name: "Efficiency",
    strength: 0.88,
    cost: 0.65,
    cooldown: 0.75,
    description:
      "Smaller effects; 35% lower energy cost and 25% faster recharge.",
  },
} as const;
export function coachMoves(
  team: MoveTeam,
  id: number,
  projection?: { profile?: PlayerProfile; xp?: number },
): MoveAssignment {
  const xp =
    projection?.xp ??
    (team.abilityMasteryVersion === 1 ? (team.abilityMastery?.[id] ?? 0) : 0);
  const empty: MoveAssignment = {
    moves: [],
    specialization: "fundamentals",
    focus: "balanced",
    xp,
    projectedFit: 0,
    nextSlot: null,
    reasons: [],
  };
  const mon = POKEMON_BY_ID.get(id);
  if (!mon || !movesEnabled(team)) return empty;
  const p = projection?.profile ?? playerProfile(mon, team.development?.[id]),
    a = p.attributes;
  const coach = getCoach(team.coach?.id ?? ""),
    tactic = team.tactic;
  const teammates = Object.values(team.roster).flatMap((member) => {
    const species = POKEMON_BY_ID.get(member!);
    return species
      ? [playerProfile(species, team.development?.[member!]).attributes]
      : [];
  });
  const average = (key: keyof typeof a) =>
    teammates.reduce((sum, value) => sum + value[key], 0) /
    Math.max(1, teammates.length);
  const specialization: Specialization =
    xp < 75
      ? "fundamentals"
      : a.stamina < 62 || (coach?.rest ?? 0.5) >= 0.65
        ? "efficiency"
        : (coach?.risk ?? 0.5) >= 0.7 &&
            a.finishing + a.strength > a.passing + a.composure
          ? "power"
          : "control";
  const value = (m: BasketballMove) => {
    if (m.signature) {
      const role =
        m.focus === "conditioning"
          ? (a.speed + a.ballHandling) / 2
          : m.focus === "playmaking"
            ? (a.passing + a.composure) / 2 +
              Math.max(0, 65 - average("passing")) * 0.35
            : m.focus === "shooting"
              ? (a.threePoint + a.midRange + a.composure) / 3
              : m.focus === "defense"
                ? (a.perimeterDefense + a.interiorDefense) / 2
                : (a.strength + p.traits.screening + a.finishing) / 3;
      const style =
        (tactic === "pace" && m.focus === "conditioning") ||
        (tactic === "perimeter" && m.focus === "shooting") ||
        (tactic === "balanced" && m.focus === "playmaking") ||
        (tactic === "interior" && m.focus === "position") ||
        (tactic === "defense" && m.focus === "defense")
          ? 12
          : 0;
      return (
        role + style + (m.signature.kind === "species" ? 16 : 8) - m.cost * 0.4
      );
    }
    const role =
      m.id === "quick-attack" || m.id === "agility"
        ? (a.speed + a.ballHandling) / 2
        : m.id === "helping-hand"
          ? (a.passing + a.composure) / 2 +
            Math.max(0, 65 - average("passing")) * 0.35
          : m.id === "protect"
            ? (a.perimeterDefense + a.interiorDefense) / 2 +
              Math.max(0, 65 - average("perimeterDefense")) * 0.35
            : m.id === "iron-defense"
              ? (a.strength + p.traits.screening) / 2
              : m.id === "double-team"
                ? (a.speed + p.traits.offBall) / 2
                : m.id === "focus-energy"
                  ? (a.threePoint + a.midRange + a.composure) / 3
                  : 48 + (100 - a.stamina) * 0.45;
    const style =
      tactic === "pace" && m.focus === "conditioning"
        ? 12
        : tactic === "perimeter" && m.focus === "shooting"
          ? 14
          : tactic === "defense" && m.focus === "defense"
            ? 14
            : tactic === "interior" && m.id === "iron-defense"
              ? 14
              : tactic === "balanced" && m.focus === "playmaking"
                ? 12
                : 0;
    const control =
      specialization === "control" &&
      ["helping-hand", "protect", "iron-defense"].includes(m.id)
        ? 6
        : 0;
    return role + style + control;
  };
  const pool = movePool(id, team.movesetVersion === 2 ? 2 : 1);
  const moves = pool
    .filter((move) => !move.signature || xp >= move.signature.minimumMastery)
    .map((move, order) => ({ move, order, value: value(move) }))
    .sort((a, b) => b.value - a.value || a.order - b.order)
    .slice(0, xp >= 400 ? 4 : xp >= 200 ? 3 : 2)
    .map((row) => row.move);
  return {
    moves,
    specialization,
    focus: moves[0].focus,
    xp,
    projectedFit: Math.min(
      100,
      moves.reduce((n, move) => n + value(move), 0) / moves.length,
    ),
    nextSlot: xp < 200 ? 200 : xp < 400 ? 400 : null,
    reasons: [
      `${coach?.name ?? "Team staff"} selects moves for ${p.bestPosition}, ${tactic} offense, stamina and roster needs.`,
      `${specializationRules[specialization].name}: ${specializationRules[specialization].description}`,
      `${moves.length} equipped moves from ${pool.length} eligible basketball adaptations; earned XP stays with the player when the coach reassigns a path.`,
    ],
  };
}
/** Small, shared valuation; never calls coachPolicy or shared evaluation recursively. */
export function moveValue(
  team: MoveTeam,
  id: number,
  profile?: PlayerProfile,
  xp?: number,
): number {
  const plan = coachMoves(team, id, { profile, xp });
  const basic = plan.moves.length
    ? Math.min(
        3,
        plan.moves.length * 0.2 +
          plan.projectedFit / 100 +
          Math.min(0.6, plan.xp / 1000) +
          (plan.specialization === "fundamentals" ? 0 : 0.4),
      )
    : 0;
  return team.movesetVersion === 2
    ? Math.min(3, basic + comboValue(team, id, profile, xp))
    : basic;
}

/** Upcoming or equipped signature practice; uses the same finite species pool and coach selection. */
export function signatureTrainingFocus(team: MoveTeam, id: number) {
  if (team.movesetVersion !== 2 || !movesEnabled(team)) return undefined;
  const signatures = movePool(id, 2).filter((m) => m.signature);
  const xp = team.abilityMastery?.[id] ?? 0;
  const next = signatures
    .filter((m) => m.signature!.minimumMastery > xp)
    .sort(
      (a, b) => a.signature!.minimumMastery - b.signature!.minimumMastery,
    )[0];
  const planned = coachMoves(team, id, {
    xp: Math.max(xp, next?.signature!.minimumMastery ?? 0),
  });
  return (
    planned.moves.find((m) => m.signature)?.focus ??
    next?.focus ??
    signatures[0]?.focus
  );
}
