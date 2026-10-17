export interface MasteryLevel {
  index: number;
  name: string;
  start: number;
  next: number | null;
}
const thresholds = [0, 75, 200, 400, 700] as const;
const names = [
  "Developing",
  "Practiced",
  "Skilled",
  "Expert",
  "Master",
] as const;
const safe = (xp: number) =>
  Number.isFinite(xp) ? Math.max(0, Math.min(1000, xp)) : 0;
export function masteryLevel(xp: number): MasteryLevel {
  const value = safe(xp);
  let index = 0;
  for (let i = 1; i < thresholds.length; i++)
    if (value >= thresholds[i]) index = i;
  return {
    index,
    name: names[index],
    start: thresholds[index],
    next: thresholds[index + 1] ?? null,
  };
}
/** Scale the ability's small existing delta, never base ratings or total shot probability. */
export function masteryFactor(xp = 0): number {
  const value = safe(xp),
    level = masteryLevel(value),
    end = level.next ?? 1000;
  return (
    1 +
    level.index * 0.04 +
    ((value - level.start) / (end - level.start)) * 0.04
  );
}
