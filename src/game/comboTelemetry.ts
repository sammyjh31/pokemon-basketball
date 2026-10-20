import { COMBO_IDS, type ComboStats } from "./comboTypes";
export const emptyComboStats = (): ComboStats => ({
  attempts: {},
  shotsCreated: {},
});
export function mergeComboStats(target: ComboStats, source: ComboStats) {
  for (const field of ["attempts", "shotsCreated"] as const)
    for (const [id, count] of Object.entries(source[field])) {
      const key = id as (typeof COMBO_IDS)[number];
      target[field][key] = (target[field][key] ?? 0) + count!;
    }
}
export function sameComboStats(a?: ComboStats, b?: ComboStats): boolean {
  return COMBO_IDS.every(
    (id) =>
      (a?.attempts[id] ?? 0) === (b?.attempts[id] ?? 0) &&
      (a?.shotsCreated[id] ?? 0) === (b?.shotsCreated[id] ?? 0),
  );
}
export function validateComboStats(raw: unknown): ComboStats {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Invalid combo statistics.");
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).length !== 2) throw Error("Invalid combo statistics.");
  for (const field of ["attempts", "shotsCreated"] as const) {
    const counts = value[field];
    if (
      !counts ||
      typeof counts !== "object" ||
      Array.isArray(counts) ||
      Object.entries(counts).some(
        ([id, count]) =>
          !COMBO_IDS.includes(id as any) ||
          !Number.isSafeInteger(count) ||
          (count as number) < 0 ||
          (count as number) > 1e9,
      )
    )
      throw Error("Invalid combo statistics.");
  }
  const attempts = value.attempts as ComboStats["attempts"],
    shotsCreated = value.shotsCreated as ComboStats["shotsCreated"];
  if (COMBO_IDS.some((id) => (shotsCreated[id] ?? 0) > (attempts[id] ?? 0)))
    throw Error("A combo shot requires a recorded setup.");
  return { attempts: { ...attempts }, shotsCreated: { ...shotsCreated } };
}
