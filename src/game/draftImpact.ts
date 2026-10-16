import { POKEMON_BY_ID } from "../data/pokemon";
import { attributes, rotationMinutes, teamRatings } from "./ratings";
import {
  ROSTER_SLOTS,
  type Roster,
  type RosterSlot,
  type RotationStyle,
  type Tactic,
} from "./types";

const IMPACT_AREAS = [
  { key: "offense", label: "Overall offense", tool: false },
  { key: "defense", label: "Overall defense", tool: false },
  { key: "spacing", label: "Shooting / spacing", tool: true },
  { key: "creation", label: "Shot creation", tool: true },
  { key: "rimProtection", label: "Rim protection", tool: true },
  { key: "rebounding", label: "Rebounding", tool: true },
] as const;
export interface DraftImpactMetric {
  key: (typeof IMPACT_AREAS)[number]["key"];
  label: string;
  tool: boolean;
  before: number | null;
  after: number;
  delta: number | null;
}
export interface DraftImpact {
  beforeCount: number;
  afterCount: number;
  metrics: DraftImpactMetric[];
}
export type DraftImpactFocus = "balance" | DraftImpactMetric["key"];
export const DRAFT_IMPACT_PRIORITIES = [
  { key: "balance", label: "Balanced offense + defense" },
  ...IMPACT_AREAS,
] as const;
export interface DraftComparisonMetric extends Omit<DraftImpactMetric, "key"> {
  key: DraftImpactFocus;
}
export interface DraftImpactProjection {
  pokemonId: number;
  impact: DraftImpact;
  metrics: DraftComparisonMetric[];
}
export interface RankedDraftImpact {
  pokemonId: number;
  metric: DraftComparisonMetric;
  rank: number;
  tied: boolean;
}
const rounded = (value: number) => Math.round(value * 10) / 10;

/** Balance is an equal average of offense and defense, not a win forecast. */
export function draftComparisonMetrics(
  impact: DraftImpact,
): DraftComparisonMetric[] {
  const offense = impact.metrics.find((metric) => metric.key === "offense")!;
  const defense = impact.metrics.find((metric) => metric.key === "defense")!;
  const before =
    offense.before === null || defense.before === null
      ? null
      : rounded((offense.before + defense.before) / 2);
  const after = rounded((offense.after + defense.after) / 2);
  return [
    {
      key: "balance",
      label: "Balanced offense + defense",
      tool: false,
      before,
      after,
      delta: before === null ? null : rounded(after - before),
    },
    ...impact.metrics,
  ];
}

/** All candidates share a baseline; rank displayed projections, including ties. */
export function draftImpactLeaders(
  prospects: { pokemonId: number; metrics: DraftComparisonMetric[] }[],
  focus: DraftImpactFocus,
): number[] {
  const scores = prospects.map((prospect) => ({
    id: prospect.pokemonId,
    value: prospect.metrics.find((metric) => metric.key === focus)?.after,
  }));
  const best = Math.max(...scores.map((score) => score.value ?? -Infinity));
  return scores
    .filter((score) => score.value === best)
    .map((score) => score.id);
}

function rosterProfile(
  roster: Roster,
  tactic: Tactic,
  rotation: RotationStyle,
) {
  const ratings = teamRatings(roster, tactic, rotation);
  const minutes = rotationMinutes(roster, rotation);
  const total = Object.values(minutes).reduce((sum, value) => sum + value, 0);
  // Rebounding uses the same attributes and expected minutes as team defense.
  const rebounding = total
    ? ROSTER_SLOTS.reduce((sum, slot) => {
        const mon = POKEMON_BY_ID.get(roster[slot] ?? -1);
        return sum + (mon ? attributes(mon).rebounding * minutes[slot] : 0);
      }, 0) / total
    : 0;
  return {
    offense: ratings.offense,
    defense: ratings.defense,
    spacing: ratings.spacing!,
    creation: ratings.creation!,
    rimProtection: ratings.rimProtection!,
    rebounding,
  };
}

/** Read-only preview of adding a unique prospect to a vacant draft slot. */
function draftImpactProjector(
  roster: Roster,
  slot: RosterSlot,
  tactic: Tactic,
  rotation: RotationStyle,
): (pokemonId: number) => DraftImpact | null {
  if (roster[slot] !== null) return () => null;
  const owned = new Set(Object.values(roster));
  const beforeCount = Object.values(roster).filter(
    (id) => id !== null && POKEMON_BY_ID.has(id),
  ).length;
  const before = rosterProfile(roster, tactic, rotation);
  return (pokemonId) => {
    if (owned.has(pokemonId) || !POKEMON_BY_ID.has(pokemonId)) return null;
    const after = rosterProfile(
      { ...roster, [slot]: pokemonId },
      tactic,
      rotation,
    );
    return {
      beforeCount,
      afterCount: beforeCount + 1,
      metrics: IMPACT_AREAS.map((area) => {
        const previous = beforeCount ? rounded(before[area.key]) : null;
        const next = rounded(after[area.key]);
        return {
          ...area,
          before: previous,
          after: next,
          delta: previous === null ? null : rounded(next - previous),
        };
      }),
    };
  };
}

export function projectDraftImpact(
  roster: Roster,
  pokemonId: number,
  slot: RosterSlot,
  tactic: Tactic,
  rotation: RotationStyle,
): DraftImpact | null {
  return draftImpactProjector(roster, slot, tactic, rotation)(pokemonId);
}

/** Reuse the current team's baseline for the entire available pool. */
export function projectDraftPool(
  pokemonIds: number[],
  roster: Roster,
  slot: RosterSlot,
  tactic: Tactic,
  rotation: RotationStyle,
): DraftImpactProjection[] {
  const project = draftImpactProjector(roster, slot, tactic, rotation);
  return [...new Set(pokemonIds)].flatMap((pokemonId) => {
    const impact = project(pokemonId);
    return impact
      ? [{ pokemonId, impact, metrics: draftComparisonMetrics(impact) }]
      : [];
  });
}

/** The common baseline makes projected-rating order equal improvement order. */
export function rankDraftImpacts(
  projections: DraftImpactProjection[],
  focus: DraftImpactFocus,
): RankedDraftImpact[] {
  const scores = projections
    .map((p) => ({
      pokemonId: p.pokemonId,
      metric: p.metrics.find((metric) => metric.key === focus)!,
    }))
    .sort(
      (a, b) => b.metric.after - a.metric.after || a.pokemonId - b.pokemonId,
    );
  let rank = 1;
  return scores.map((entry, i) => {
    const equalPrevious =
      i > 0 && scores[i - 1].metric.after === entry.metric.after;
    if (!equalPrevious) rank = i + 1;
    return {
      ...entry,
      rank,
      tied: equalPrevious || scores[i + 1]?.metric.after === entry.metric.after,
    };
  });
}
