import { allBasketballMoves, movesEnabled } from "./basketballMoves";
import { getCoach } from "./trainerCoaches";
import { capMoveEffects, type MoveParticipant } from "./matchMoves";
import { emptyMoveStats } from "./moveTelemetry";
import type { MoveEvent, MoveId, MoveTeam } from "./moveTypes";
import type { ComboId, ComboEvent } from "./comboTypes";
import type { ComboRuntime, ComboPlayer } from "./matchCombos";
import type { PlayerProfile } from "./playerProfile";
import {
  COUNTER_IDS,
  type CounterId,
  type CounterComboId,
  type CounterEvent,
  type CounterPlan,
  type MoveReads,
} from "./counterTypes";
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const round = (n: number) => Math.round(n * 1e6) / 1e6;
export interface CounterRuntime {
  teamId: number;
  reads: MoveReads;
  observed: MoveReads;
  prior: CounterPlan[];
  adaptability: number;
  readyAt: Record<string, number>;
  used: boolean;
}
export type CounterPlayer = ComboPlayer & { profile: PlayerProfile };
function moveRead(id: MoveId): CounterId | undefined {
  const move = allBasketballMoves.find((m) => m.id === id)!;
  if (move.opportunities.some((o) => o === "screen")) return "switch-deny";
  if (move.opportunities.some((o) => o === "pass")) return "disrupt-relay";
  if (move.opportunities.some((o) => o === "drive" || o === "cut"))
    return "contain-burst";
  if (move.opportunities.some((o) => o === "shoot")) return "top-lock";
}
const comboRead = (id: ComboId): CounterId =>
  id === "pick-roll" || id === "pick-pop" ? "switch-deny" : "disrupt-relay";
export function counterPlans(reads: MoveReads): CounterPlan[] {
  const totals = Object.fromEntries(COUNTER_IDS.map((id) => [id, 0])) as Record<
    CounterId,
    number
  >;
  for (const [id, n] of Object.entries(reads.moves)) {
    const key = moveRead(id as MoveId);
    if (key) totals[key] += n!;
  }
  for (const [id, n] of Object.entries(reads.combos))
    totals[comboRead(id as ComboId)] += n!;
  return COUNTER_IDS.map((id) => ({
    id,
    observations: totals[id],
    confidence: Math.min(0.85, totals[id] / (totals[id] + 6)),
  }))
    .filter((p) => p.observations >= 3)
    .sort((a, b) => b.observations - a.observations);
}
export function createCounterRuntime(
  team: MoveTeam & { id: number },
  prior?: MoveReads,
): CounterRuntime | undefined {
  if (
    team.movesetVersion !== 3 ||
    !movesEnabled(team) ||
    team.engineRules?.adaptiveCoaching === false
  )
    return;
  const reads = prior ? structuredClone(prior) : { moves: {}, combos: {} };
  return {
    teamId: team.id,
    reads,
    observed: { moves: {}, combos: {} },
    prior: counterPlans(reads),
    adaptability: getCoach(team.coach?.id ?? "")?.adaptability ?? 0.5,
    readyAt: {},
    used: false,
  };
}
export function beginCounterSegment(runtime?: CounterRuntime) {
  if (runtime) runtime.used = false;
}
function ready(
  runtime: CounterRuntime,
  p: CounterPlayer,
  now: number,
  active: readonly CounterPlayer[],
  cost: number,
) {
  return (
    Number.isFinite(now) &&
    now >= 0 &&
    !runtime.used &&
    active.includes(p) &&
    p.box.teamId === runtime.teamId &&
    (p.box.fouls ?? 0) < 6 &&
    p.moves?.version === 3 &&
    p.energy >= 35 + cost &&
    now >= (runtime.readyAt[p.box.playerId] ?? 0)
  );
}
function pay(
  runtime: CounterRuntime,
  players: CounterPlayer[],
  id: CounterId | CounterComboId,
  now: number,
  cost: number,
) {
  runtime.used = true;
  return players.map((p) => {
    const before = p.energy;
    p.energy = Math.max(25, before - cost);
    runtime.readyAt[p.box.playerId] = now + 55;
    const ability = (p.box.abilityActivations ??= {
      offense: 0,
      support: 0,
      defense: 0,
    });
    const moves = (ability.moves ??= emptyMoveStats());
    const counters = (moves.counters ??= { responses: {}, counterCombos: {} });
    if (COUNTER_IDS.includes(id as CounterId)) {
      const key = id as CounterId;
      counters.responses[key] = (counters.responses[key] ?? 0) + 1;
    } else {
      const key = id as CounterComboId;
      counters.counterCombos[key] = (counters.counterCombos[key] ?? 0) + 1;
    }
    const energy = round(before - p.energy);
    moves.energySpent = round(moves.energySpent + energy);
    return energy;
  });
}
function strength(
  runtime: CounterRuntime,
  read: CounterPlan,
  players: CounterPlayer[],
  chemistry = 50,
) {
  const quality =
    players.reduce(
      (sum, p) =>
        sum +
        (p.profile.attributes.perimeterDefense +
          p.profile.attributes.interiorDefense +
          p.profile.traits.decisionMaking) /
          300,
      0,
    ) / players.length;
  const mastery =
    players.reduce(
      (sum, p) => sum + Math.min(1000, p.moves!.plan.xp) / 1000,
      0,
    ) / players.length;
  return clamp(
    read.confidence *
      (0.16 + runtime.adaptability * 0.14 + quality * 0.12 + mastery * 0.08) *
      (0.85 + clamp(chemistry, 0, 100) * 0.003),
    0.02,
    0.42,
  );
}
/** Only remove bonuses the actual paid activation added; never lower base skills. */
function suppress(players: MoveParticipant[], id: CounterId, amount: number) {
  const changes: {
    player: MoveParticipant;
    key: keyof NonNullable<MoveParticipant["moves"]>["effects"];
    delta: number;
  }[] = [];
  const fields =
    id === "contain-burst"
      ? (["movement", "drive"] as const)
      : id === "top-lock"
        ? (["shot"] as const)
        : id === "switch-deny"
          ? (["screen", "movement"] as const)
          : (["passing", "shot", "movement"] as const);
  for (const player of players) {
    const effects = player.moves!.effects;
    for (const key of fields) {
      const base = ["shot", "drive"].includes(key) ? 0 : 1;
      const delta = Math.max(0, effects[key] - base) * amount;
      if (delta > 1e-9) {
        effects[key] -= delta;
        changes.push({ player, key, delta });
      }
    }
  }
  return changes;
}
export function counterMove(
  runtime: CounterRuntime | undefined,
  attacker: CounterPlayer,
  defender: CounterPlayer,
  event: MoveEvent,
  now: number,
  active: readonly CounterPlayer[],
  receiver?: CounterPlayer,
): CounterEvent | undefined {
  if (
    !runtime ||
    event.playerId !== attacker.box.playerId ||
    attacker.box.teamId === runtime.teamId ||
    !["drive", "cut", "pass", "screen", "shoot"].includes(event.opportunity)
  )
    return;
  runtime.observed.moves[event.move] =
    (runtime.observed.moves[event.move] ?? 0) + 1;
  runtime.reads.moves[event.move] = (runtime.reads.moves[event.move] ?? 0) + 1;
  const id = moveRead(event.move),
    read = counterPlans(runtime.reads).find((p) => p.id === id);
  if (!id || !read || !ready(runtime, defender, now, active, 2.5)) return;
  const amount = strength(runtime, read, [defender]);
  const changes = suppress(
    receiver ? [attacker, receiver] : [attacker],
    id,
    amount,
  );
  if (!changes.length) return;
  return {
    id,
    target: event.move,
    playerIds: [defender.box.playerId],
    elapsedSeconds: now,
    confidence: read.confidence,
    adjustment: amount,
    energySpent: pay(runtime, [defender], id, now, 2.5),
  };
}
export interface CounterContext {
  now: number;
  offense: readonly CounterPlayer[];
  defense: readonly CounterPlayer[];
  guards: Map<CounterPlayer, CounterPlayer>;
  offenseChemistry: number;
  defenseChemistry: number;
}
export function counterCombo(
  def: CounterRuntime | undefined,
  off: CounterRuntime | undefined,
  combo: ComboRuntime,
  event: ComboEvent,
  c: CounterContext,
): CounterEvent[] {
  if (!def || event.stage !== "setup") return [];
  const pending = combo.pending;
  if (
    !pending ||
    pending.readByDefense ||
    pending.plan.id !== event.id ||
    event.playerIds[0] !== pending.a.box.playerId ||
    event.playerIds[1] !== pending.b.box.playerId
  )
    return [];
  pending.readByDefense = true;
  def.observed.combos[event.id] = (def.observed.combos[event.id] ?? 0) + 1;
  def.reads.combos[event.id] = (def.reads.combos[event.id] ?? 0) + 1;
  const a = pending.a as CounterPlayer,
    b = pending.b as CounterPlayer;
  const d = c.guards.get(a),
    e = c.guards.get(b);
  const id = comboRead(event.id),
    read = counterPlans(def.reads).find((p) => p.id === id);
  if (
    !read ||
    !d ||
    !e ||
    d === e ||
    !c.offense.includes(a) ||
    !c.offense.includes(b) ||
    !ready(def, d, c.now, c.defense, 3) ||
    !ready(def, e, c.now, c.defense, 3) ||
    Math.min(d.moves!.plan.xp, e.moves!.plan.xp) < 25
  )
    return [];
  const amount = strength(def, read, [d, e], c.defenseChemistry);
  const changes = suppress([a, b], id, amount);
  if (!changes.length) return [];
  pending.countered = true;
  pending.strength *= 1 - amount;
  const events: CounterEvent[] = [
    {
      id,
      target: event.id,
      playerIds: [d.box.playerId, e.box.playerId],
      elapsedSeconds: c.now,
      confidence: read.confidence,
      adjustment: amount,
      energySpent: pay(def, [d, e], id, c.now, 3),
    },
  ];
  // One offensive answer to a visible defensive response; no recursive counter chain.
  if (
    !off ||
    c.offenseChemistry < 40 ||
    Math.min(a.moves!.plan.xp, b.moves!.plan.xp) < 75 ||
    !ready(off, a, c.now, c.offense, 3.5) ||
    !ready(off, b, c.now, c.offense, 3.5)
  )
    return events;
  const response: CounterComboId =
    id === "switch-deny" ? "slip-and-seal" : "reverse-relay";
  const recovery = clamp(
    0.3 + off.adaptability * 0.3 + c.offenseChemistry * 0.002,
    0.3,
    0.8,
  );
  for (const change of changes)
    change.player.moves!.effects[change.key] += change.delta * recovery;
  pending.strength /= 1 - amount;
  pending.strength *= 1 - amount * (1 - recovery);
  capMoveEffects(a);
  capMoveEffects(b);
  events.push({
    id: response,
    target: event.id,
    playerIds: [a.box.playerId, b.box.playerId],
    elapsedSeconds: c.now,
    confidence: read.confidence,
    adjustment: amount * recovery,
    energySpent: pay(off, [a, b], response, c.now, 3.5),
  });
  return events;
}
