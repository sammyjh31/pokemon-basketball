import {
  emptyCounterStats,
  mergeCounterStats,
  sameCounterStats,
  validateCounterStats,
} from "./counterTelemetry";
import { MOVE_IDS, type MoveStats } from "./moveTypes";
import {
  emptyComboStats,
  mergeComboStats,
  sameComboStats,
  validateComboStats,
} from "./comboTelemetry";
const round = (value: number) => Math.round(value * 1e6) / 1e6;
export const emptyMoveStats = (): MoveStats => ({
  uses: {},
  energySpent: 0,
  energyRecovered: 0,
});
export function mergeMoveStats(target: MoveStats, source: MoveStats) {
  for (const [id, count] of Object.entries(source.uses)) {
    const key = id as (typeof MOVE_IDS)[number];
    target.uses[key] = (target.uses[key] ?? 0) + count!;
  }
  target.energySpent = round(target.energySpent + source.energySpent);
  target.energyRecovered = round(
    target.energyRecovered + source.energyRecovered,
  );
  if (source.counters)
    mergeCounterStats(
      (target.counters ??= emptyCounterStats()),
      source.counters,
    );
  if (source.combos)
    mergeComboStats((target.combos ??= emptyComboStats()), source.combos);
}
/** Summary-only seasons predate moves; only recorded years can contribute. */
export function sameMoveStats(a?: MoveStats, b?: MoveStats): boolean {
  return (
    MOVE_IDS.every((id) => (a?.uses[id] ?? 0) === (b?.uses[id] ?? 0)) &&
    (a?.energySpent ?? 0) === (b?.energySpent ?? 0) &&
    (a?.energyRecovered ?? 0) === (b?.energyRecovered ?? 0) &&
    sameCounterStats(a?.counters, b?.counters) &&
    sameComboStats(a?.combos, b?.combos)
  );
}
export function validateMoveStats(raw: unknown): MoveStats {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Invalid move statistics.");
  const value = raw as Record<string, unknown>,
    uses = value.uses;
  if (
    Object.keys(value).length !==
      3 +
        Number(value.combos !== undefined) +
        Number(value.counters !== undefined) ||
    !uses ||
    typeof uses !== "object" ||
    Array.isArray(uses) ||
    Object.entries(uses).some(
      ([key, count]) =>
        !MOVE_IDS.includes(key as any) ||
        !Number.isSafeInteger(count) ||
        (count as number) < 0 ||
        (count as number) > 1e9,
    ) ||
    [value.energySpent, value.energyRecovered].some(
      (n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1e9,
    )
  )
    throw Error("Invalid move statistics.");
  return {
    uses: { ...uses },
    energySpent: value.energySpent as number,
    energyRecovered: value.energyRecovered as number,
    ...(value.counters !== undefined
      ? { counters: validateCounterStats(value.counters) }
      : {}),
    ...(value.combos !== undefined
      ? { combos: validateComboStats(value.combos) }
      : {}),
  };
}
