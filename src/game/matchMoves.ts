import { coachMoves, specializationRules } from "./movePolicy";
import { movesEnabled } from "./basketballMoves";
import { getCoach } from "./trainerCoaches";
import { emptyMoveStats } from "./moveTelemetry";
import type { AbilityBox } from "./abilities";
import type {
  MoveAssignment,
  MoveEvent,
  MoveId,
  MoveOpportunity,
  MoveTeam,
} from "./moveTypes";
export const neutralMoveEffects = () => ({
  movement: 1,
  passing: 1,
  screen: 1,
  navigation: 1,
  shot: 0,
  contest: 0,
  drive: 0,
});
export interface MoveRuntime {
  plan: MoveAssignment;
  effects: ReturnType<typeof neutralMoveEffects>;
  readyAt: Partial<Record<MoveId, number>>;
  used: boolean;
  risk: number;
}
type Mover = {
  moves?: MoveRuntime;
  energy: number;
  box: AbilityBox & { playerId: string };
};
export function createMoveRuntime(
  team: MoveTeam,
  id: number,
): MoveRuntime | undefined {
  return movesEnabled(team)
    ? {
        plan: coachMoves(team, id),
        effects: neutralMoveEffects(),
        readyAt: {},
        used: false,
        risk: getCoach(team.coach?.id ?? "")?.risk ?? 0.5,
      }
    : undefined;
}
export function beginMoveSegment(players: readonly Mover[]) {
  for (const p of players)
    if (p.moves) {
      p.moves.effects = neutralMoveEffects();
      p.moves.used = false;
    }
}
/** Match-local, deterministic opportunity decisions; never reads a future shot roll. */
export function activateMove(
  player: Mover,
  opportunity: MoveOpportunity,
  now: number,
  context: { clock: number; zone?: string; receiver?: Mover },
): MoveEvent | undefined {
  const state = player.moves;
  if (
    !state ||
    state.used ||
    !Number.isFinite(now) ||
    now < 0 ||
    context.clock < 1
  )
    return;
  const rules = specializationRules[state.plan.specialization];
  const move = state.plan.moves.find(
    (move) =>
      move.opportunities.includes(opportunity) &&
      now >= (state.readyAt[move.id] ?? 0) &&
      (move.id !== "recover" || player.energy <= 52) &&
      (move.id !== "iron-defense" ||
        opportunity !== "defend" ||
        context.zone === "rim") &&
      (move.id !== "focus-energy" || context.zone !== "rim") &&
      (move.id !== "helping-hand" || context.receiver?.moves !== undefined) &&
      player.energy >= 25 + move.cost * rules.cost + (1 - state.risk) * 4,
  );
  if (!move) return;
  state.used = true;
  state.readyAt[move.id] = now + move.cooldown * rules.cooldown;
  const strength =
    rules.strength *
    (1 + Math.min(1000, state.plan.xp) / 5000) *
    (state.plan.specialization === "control" &&
    ["pass", "defend", "screen", "navigate"].includes(opportunity)
      ? 1.15
      : 1);
  const before = player.energy;
  player.energy = Math.max(25, before - move.cost * rules.cost);
  const energySpent = before - player.energy;
  let energyRecovered = 0;
  const e = state.effects;
  switch (move.id) {
    case "quick-attack":
      e.movement += 0.12 * strength;
      e.drive += 0.055 * strength;
      break;
    case "agility":
      e.movement += 0.17 * strength;
      break;
    case "helping-hand":
      e.passing += 0.09 * strength;
      context.receiver!.moves!.effects.shot = Math.max(
        context.receiver!.moves!.effects.shot,
        0.055 * strength,
      );
      break;
    case "protect":
      e.movement += 0.1 * strength;
      e.contest += 0.07 * strength;
      break;
    case "iron-defense":
      e.screen += 0.15 * strength;
      e.contest += 0.085 * strength;
      break;
    case "double-team":
      e.movement += 0.1 * strength;
      e.navigation += 0.16 * strength;
      break;
    case "focus-energy":
      e.shot += 0.08 * strength;
      break;
    case "recover": {
      const next = Math.min(100, player.energy + 9 * strength);
      energyRecovered = next - player.energy;
      player.energy = next;
      break;
    }
  }
  const a = (player.box.abilityActivations ??= {
    offense: 0,
    support: 0,
    defense: 0,
  });
  const stats = (a.moves ??= emptyMoveStats());
  stats.uses[move.id] = (stats.uses[move.id] ?? 0) + 1;
  stats.energySpent = Math.round((stats.energySpent + energySpent) * 1e6) / 1e6;
  stats.energyRecovered =
    Math.round((stats.energyRecovered + energyRecovered) * 1e6) / 1e6;
  return {
    playerId: player.box.playerId,
    move: move.id,
    specialization: state.plan.specialization,
    opportunity,
    elapsedSeconds: now,
    energySpent,
    energyRecovered,
  };
}
