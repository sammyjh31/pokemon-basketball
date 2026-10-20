import {
  COUNTER_IDS,
  COUNTER_COMBO_IDS,
  type CounterStats,
  type MoveReads,
} from "./counterTypes";
import { MOVE_IDS } from "./moveTypes";
import { COMBO_IDS } from "./comboTypes";
export const emptyCounterStats = (): CounterStats => ({
  responses: {},
  counterCombos: {},
});
export function mergeCounterStats(target: CounterStats, source: CounterStats) {
  for (const [id, count] of Object.entries(source.responses)) {
    const key = id as (typeof COUNTER_IDS)[number];
    target.responses[key] = (target.responses[key] ?? 0) + count!;
  }
  for (const [id, count] of Object.entries(source.counterCombos)) {
    const key = id as (typeof COUNTER_COMBO_IDS)[number];
    target.counterCombos[key] = (target.counterCombos[key] ?? 0) + count!;
  }
}
export function sameCounterStats(a?: CounterStats, b?: CounterStats) {
  return (
    COUNTER_IDS.every(
      (id) => (a?.responses[id] ?? 0) === (b?.responses[id] ?? 0),
    ) &&
    COUNTER_COMBO_IDS.every(
      (id) => (a?.counterCombos[id] ?? 0) === (b?.counterCombos[id] ?? 0),
    )
  );
}
function counts(
  raw: unknown,
  known: readonly string[],
  integer: boolean,
): Record<string, number> {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(raw))
  )
    throw Error("Invalid counter observations or statistics.");
  for (const [id, n] of Object.entries(raw))
    if (
      !known.includes(id) ||
      typeof n !== "number" ||
      !Number.isFinite(n) ||
      n < 0 ||
      n > 1e6 ||
      (integer && !Number.isSafeInteger(n))
    )
      throw Error("Invalid counter observations or statistics.");
  return { ...raw } as Record<string, number>;
}
function pair(raw: unknown, a: string, b: string): Record<string, unknown> {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).length !== 2 ||
    !Object.hasOwn(raw, a) ||
    !Object.hasOwn(raw, b)
  )
    throw Error("Invalid counter observations or statistics.");
  return raw as Record<string, unknown>;
}
export function validateCounterStats(raw: unknown): CounterStats {
  const v = pair(raw, "responses", "counterCombos");
  return {
    responses: counts(v.responses, COUNTER_IDS, true),
    counterCombos: counts(v.counterCombos, COUNTER_COMBO_IDS, true),
  };
}
export function validateMoveReads(raw: unknown): MoveReads {
  const v = pair(raw, "moves", "combos");
  return {
    moves: counts(v.moves, MOVE_IDS, false),
    combos: counts(v.combos, COMBO_IDS, false),
  };
}
/** Discount known history, then add only this completed game's observed offensive actions. */
export function updatedMoveReads(
  prior?: MoveReads,
  observed?: MoveReads,
): MoveReads {
  const value: MoveReads = { moves: {}, combos: {} };
  for (const id of MOVE_IDS) {
    const n = (prior?.moves[id] ?? 0) * 0.65 + (observed?.moves[id] ?? 0);
    if (n >= 0.05) value.moves[id] = n;
  }
  for (const id of COMBO_IDS) {
    const n = (prior?.combos[id] ?? 0) * 0.65 + (observed?.combos[id] ?? 0);
    if (n >= 0.05) value.combos[id] = n;
  }
  return value;
}
