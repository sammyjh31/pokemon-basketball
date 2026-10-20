import { coachCombos, combosEnabled } from "./comboPolicy";
import {
  comboPlays,
  type ComboAssignment,
  type ComboEvent,
  type ComboId,
} from "./comboTypes";
import { emptyComboStats } from "./comboTelemetry";
import { capMoveEffects, type MoveParticipant } from "./matchMoves";
import { specializationRules } from "./movePolicy";
import { emptyMoveStats } from "./moveTelemetry";
import { getCoach } from "./trainerCoaches";
import type { MoveTeam } from "./moveTypes";
export interface ComboPlayer extends MoveParticipant {
  box: MoveParticipant["box"] & {
    teamId: number;
    pokemonId: number;
    fouls?: number;
  };
}
export interface ComboRuntime {
  teamId: number;
  plans: ComboAssignment[];
  readyAt: Record<string, number>;
  risk: number;
  pending?: {
    plan: ComboAssignment;
    a: ComboPlayer;
    b: ComboPlayer;
    received: boolean;
    cancelled?: boolean;
    countered?: boolean;
    readByDefense?: boolean;
    now: number;
    strength: number;
    lineupChemistry: number;
  };
}
const COST = 3.5,
  COOLDOWN = 100;
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const cost = (p: ComboPlayer) =>
  COST * specializationRules[p.moves!.plan.specialization].cost;
export function createComboRuntime(
  team: MoveTeam & { id: number },
): ComboRuntime | undefined {
  return combosEnabled(team)
    ? {
        teamId: team.id,
        plans: coachCombos(team),
        readyAt: {},
        risk: getCoach(team.coach?.id ?? "")?.risk ?? 0.5,
      }
    : undefined;
}
export function beginComboSegment(runtime?: ComboRuntime) {
  if (runtime) delete runtime.pending;
}
function ready(
  runtime: ComboRuntime,
  p: ComboPlayer,
  now: number,
  checkUsed = true,
) {
  return (
    Number.isFinite(now) &&
    now >= 0 &&
    p.box.teamId === runtime.teamId &&
    (p.box.fouls ?? 0) < 6 &&
    p.moves !== undefined &&
    p.moves.version >= 2 &&
    p.moves.plan.xp >= 25 &&
    (!checkUsed || !p.moves.used) &&
    Number.isFinite(p.energy) &&
    p.energy >= 35 + cost(p) &&
    now >= (runtime.readyAt[p.box.playerId] ?? 0)
  );
}
function pairReady(
  runtime: ComboRuntime,
  plan: ComboAssignment,
  active: readonly ComboPlayer[],
  now: number,
  checkUsed = true,
) {
  const a = active.find((p) => p.box.pokemonId === plan.initiatorId),
    b = active.find((p) => p.box.pokemonId === plan.partnerId);
  return (
    a &&
    b &&
    a !== b &&
    a.box.playerId !== b.box.playerId &&
    ready(runtime, a, now, checkUsed) &&
    ready(runtime, b, now, checkUsed)
  );
}
/** Planning precedes segment reset, so only clock/energy readiness matters here. */
export function comboPlayWeights(
  runtime: ComboRuntime | undefined,
  active: readonly ComboPlayer[],
  now: number,
): Partial<Record<"pickRoll" | "spotUp" | "isolation", number>> {
  const weights: Partial<Record<"pickRoll" | "spotUp" | "isolation", number>> =
    {};
  if (!runtime) return weights;
  for (const plan of runtime.plans) {
    if (!plan.unlocked || plan.fit < 58 + (1 - runtime.risk) * 5) continue;
    if (!pairReady(runtime, plan, active, now, false)) continue;
    const play = comboPlays.find((p) => p.id === plan.id)!.play;
    weights[play] = Math.min(18, (weights[play] ?? 0) + plan.fit * 0.1);
  }
  return weights;
}
/** Hold the individual drive move only for an executable kickout pair. */
export function reserveComboDrive(
  runtime: ComboRuntime | undefined,
  driver: ComboPlayer,
  active: readonly ComboPlayer[],
  now: number,
  clock: number,
): boolean {
  return (
    !!runtime &&
    !runtime.pending &&
    clock >= 6 &&
    runtime.plans.some(
      (plan) =>
        plan.id === "drive-kick" &&
        plan.initiatorId === driver.box.pokemonId &&
        plan.unlocked &&
        plan.fit >= 58 + (1 - runtime.risk) * 5 &&
        pairReady(runtime, plan, active, now),
    )
  );
}
/** A modest read preference; lanes, time and interception rolls still decide. */
export function comboReceiverPreference(
  runtime: ComboRuntime | undefined,
  from: ComboPlayer,
  to: ComboPlayer,
): number {
  const pending = runtime?.pending;
  return pending?.a === from && pending.b === to && !pending.cancelled
    ? 1.4 * pending.strength
    : 0;
}
function record(
  p: ComboPlayer,
  id: ComboId,
  stage: "setup" | "shot",
  spent = 0,
) {
  const activation = (p.box.abilityActivations ??= {
    offense: 0,
    support: 0,
    defense: 0,
  });
  const moves = (activation.moves ??= emptyMoveStats()),
    stats = (moves.combos ??= emptyComboStats());
  const counts = stage === "setup" ? stats.attempts : stats.shotsCreated;
  counts[id] = (counts[id] ?? 0) + 1;
  moves.energySpent = round(moves.energySpent + spent);
}
/** Called only after committing the setup action; it never predicts pass/shot rolls. */
export function startCombo(
  runtime: ComboRuntime | undefined,
  kind: "screen" | "pass" | "kickout",
  a: ComboPlayer,
  b: ComboPlayer,
  now: number,
  context: {
    clock: number;
    active: readonly ComboPlayer[];
    hadDrive?: boolean;
    chemistry?: number;
  },
): ComboEvent | undefined {
  if (
    !runtime ||
    runtime.pending ||
    !Number.isFinite(context.clock) ||
    context.clock < 3 ||
    a === b ||
    a.box.playerId === b.box.playerId ||
    !context.active.includes(a) ||
    !context.active.includes(b) ||
    !ready(runtime, a, now) ||
    !ready(runtime, b, now)
  )
    return;
  const lineupChemistry = Number.isFinite(context.chemistry)
    ? Math.max(0, Math.min(100, context.chemistry!))
    : 50;
  const plan = runtime.plans.find(
    (p) =>
      p.initiatorId === a.box.pokemonId &&
      p.partnerId === b.box.pokemonId &&
      p.unlocked &&
      p.mastery >= 25 &&
      p.fit + (lineupChemistry - 50) * 0.04 >= 58 + (1 - runtime.risk) * 5 &&
      comboPlays.find((c) => c.id === p.id)!.setup === kind &&
      (p.id !== "drive-kick" || context.hadDrive),
  );
  if (!plan) return;
  const mastery = Math.min(
    plan.mastery,
    a.moves!.plan.xp,
    b.moves!.plan.xp,
    1000,
  );
  const specialization =
    (specializationRules[a.moves!.plan.specialization].strength +
      specializationRules[b.moves!.plan.specialization].strength) /
    2;
  const strength = Math.min(
    1.25,
    (0.5 + plan.familiarity * 0.3 + mastery / 5000) *
      specialization *
      (0.85 + lineupChemistry * 0.0015),
  );
  const spent = [a, b].map((p) => {
    const before = p.energy;
    p.energy -= cost(p);
    p.moves!.used = true;
    runtime.readyAt[p.box.playerId] = now + COOLDOWN;
    record(p, plan.id, "setup", before - p.energy);
    return before - p.energy;
  }) as [number, number];
  if (kind === "screen") {
    b.moves!.effects.screen += 0.1 * strength;
    a.moves!.effects.movement += 0.06 * strength;
  } else {
    a.moves!.effects.passing += 0.06 * strength;
    b.moves!.effects.movement += 0.06 * strength;
  }
  capMoveEffects(a);
  capMoveEffects(b);
  runtime.pending = {
    plan,
    a,
    b,
    received: false,
    now,
    strength,
    lineupChemistry,
  };
  return {
    id: plan.id,
    stage: "setup",
    playerIds: [a.box.playerId, b.box.playerId],
    elapsedSeconds: now,
    chemistry: plan.chemistry,
    lineupChemistry,
    mastery,
    strength,
    energySpent: spent,
  };
}
/** Only a successful actual pass can arm the specified partner's follow-through. */
export function noteComboPass(
  runtime: ComboRuntime | undefined,
  from: ComboPlayer,
  to: ComboPlayer,
) {
  const pending = runtime?.pending;
  if (!pending || pending.cancelled) return;
  pending.received = pending.a === from && pending.b === to;
  // A wrong pass ends this combination, but the paid segment remains consumed.
  if (!pending.received) pending.cancelled = true;
}
export function completeCombo(
  runtime: ComboRuntime | undefined,
  shooter: ComboPlayer,
  zone: "rim" | "mid" | "three",
  now: number,
): ComboEvent | undefined {
  const pending = runtime?.pending;
  if (
    !pending ||
    !pending.received ||
    pending.cancelled ||
    pending.b !== shooter ||
    !Number.isFinite(now) ||
    now < pending.now ||
    !comboPlays.find((p) => p.id === pending.plan.id)!.zones.includes(zone)
  )
    return;
  delete runtime!.pending;
  shooter.moves!.effects.shot += 0.055 * pending.strength;
  capMoveEffects(shooter);
  for (const p of [pending.a, pending.b]) record(p, pending.plan.id, "shot");
  return {
    id: pending.plan.id,
    stage: "shot",
    playerIds: [pending.a.box.playerId, pending.b.box.playerId],
    elapsedSeconds: now,
    chemistry: pending.plan.chemistry,
    lineupChemistry: pending.lineupChemistry,
    mastery: Math.min(pending.a.moves!.plan.xp, pending.b.moves!.plan.xp),
    strength: pending.strength,
    energySpent: [0, 0],
  };
}
