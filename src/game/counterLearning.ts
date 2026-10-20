import {
  COUNTER_IDS,
  COUNTER_COMBO_IDS,
  type CounterId,
  type CounterComboId,
} from "./counterTypes";
export type CounterKey = CounterId | CounterComboId;
export interface CounterSample {
  attacks: number;
  points: number;
  scoreless: number;
  turnovers: number;
  fouls: number;
  energy: number;
  answered: number;
}
export interface CounterResults {
  version: 1;
  counters: Partial<
    Record<CounterKey, { used: CounterSample; without: CounterSample }>
  >;
}
export interface CounterDecision {
  emphasis: "explore" | "balanced" | "emphasize" | "reduce";
  attacks: number;
  comparisonAttacks: number;
  pointsPerAttack: number;
  comparisonPointsPerAttack: number;
  confidence: number;
  value: number;
}
export const COUNTER_KEYS = [...COUNTER_IDS, ...COUNTER_COMBO_IDS] as const;
const FIELDS = [
  "attacks",
  "points",
  "scoreless",
  "turnovers",
  "fouls",
  "energy",
  "answered",
] as const;
export const emptyCounterSample = (): CounterSample => ({
  attacks: 0,
  points: 0,
  scoreless: 0,
  turnovers: 0,
  fouls: 0,
  energy: 0,
  answered: 0,
});
export const emptyCounterResults = (): CounterResults => ({
  version: 1,
  counters: {},
});
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const invalid = (): never => {
  throw Error("Invalid counter outcome evidence.");
};
function record(v: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(v))
  )
    return invalid();
  const names = Reflect.ownKeys(v);
  if (
    names.some((k) => typeof k !== "string") ||
    (keys &&
      (names.length !== keys.length || keys.some((k) => !Object.hasOwn(v, k))))
  )
    return invalid();
  return v as Record<string, unknown>;
}
function sample(v: unknown): CounterSample {
  const input = record(v, FIELDS);
  for (const key of FIELDS)
    if (
      typeof input[key] !== "number" ||
      !Number.isFinite(input[key]) ||
      (input[key] as number) < 0 ||
      (input[key] as number) > 1e6
    )
      return invalid();
  const n = input as unknown as CounterSample;
  if (
    n.points > n.attacks * 6 + 1e-6 ||
    n.energy > n.attacks * 20 + 1e-6 ||
    [n.scoreless, n.turnovers, n.fouls, n.answered].some(
      (v) => v > n.attacks + 1e-6,
    )
  )
    return invalid();
  return { ...n };
}
export function validateCounterResults(raw: unknown): CounterResults {
  const input = record(raw, ["version", "counters"]);
  if (input.version !== 1) return invalid();
  const counters: CounterResults["counters"] = {};
  for (const [id, v] of Object.entries(record(input.counters))) {
    if (!COUNTER_KEYS.includes(id as CounterKey)) return invalid();
    const row = record(v, ["used", "without"]);
    counters[id as CounterKey] = {
      used: sample(row.used),
      without: sample(row.without),
    };
  }
  return { version: 1, counters };
}
/** Discount old encounters, then add only observed completed attacks. */
export function updateCounterResults(
  prior?: CounterResults,
  observed?: CounterResults,
  decay = 0.65,
): CounterResults {
  const next = emptyCounterResults();
  for (const id of COUNTER_KEYS) {
    const row = { used: emptyCounterSample(), without: emptyCounterSample() };
    for (const side of ["used", "without"] as const)
      for (const field of FIELDS)
        row[side][field] = round(
          (prior?.counters[id]?.[side][field] ?? 0) * decay +
            (observed?.counters[id]?.[side][field] ?? 0),
        );
    if (row.used.attacks + row.without.attacks >= 0.05) next.counters[id] = row;
  }
  return next;
}
/** Descriptive, opponent-specific comparison with neutral priors, not causal attribution. */
export function counterDecision(
  results: CounterResults | undefined,
  id: CounterKey,
): CounterDecision {
  const row = results?.counters[id],
    used = row?.used ?? emptyCounterSample(),
    without = row?.without ?? emptyCounterSample();
  const rate = (s: CounterSample) => (s.points + 6 * 1.1) / (s.attacks + 6);
  const confidence =
    (used.attacks / (used.attacks + 12)) *
    (without.attacks / (without.attacks + 8));
  const direction = COUNTER_IDS.includes(id as CounterId) ? -1 : 1;
  const value = Math.max(
    -0.4,
    Math.min(
      0.4,
      (direction * (rate(used) - rate(without)) -
        (used.energy / Math.max(1, used.attacks)) * 0.006) *
        confidence,
    ),
  );
  const emphasis =
    used.attacks < 6 || without.attacks < 4
      ? "explore"
      : value > 0.045
        ? "emphasize"
        : value < -0.045
          ? "reduce"
          : "balanced";
  return {
    emphasis,
    attacks: used.attacks,
    comparisonAttacks: without.attacks,
    pointsPerAttack: used.attacks ? used.points / used.attacks : 0,
    comparisonPointsPerAttack: without.attacks
      ? without.points / without.attacks
      : 0,
    confidence,
    value,
  };
}
/** Deterministic exploration leaves a comparison sample even for favored responses. */
export function counterUse(
  results: CounterResults,
  id: CounterKey,
  serial: number,
): boolean {
  const emphasis = counterDecision(results, id).emphasis;
  return emphasis === "reduce"
    ? serial % 4 === 1
    : emphasis === "emphasize"
      ? serial % 8 !== 0
      : emphasis === "balanced"
        ? serial % 4 !== 0
        : serial % 3 !== 0;
}
export function addCounterOutcome(
  results: CounterResults,
  id: CounterKey,
  used: boolean,
  outcome: Omit<CounterSample, "attacks">,
) {
  const row = (results.counters[id] ??= {
    used: emptyCounterSample(),
    without: emptyCounterSample(),
  })[used ? "used" : "without"];
  row.attacks++;
  for (const key of FIELDS) if (key !== "attacks") row[key] += outcome[key];
}
