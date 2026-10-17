import {
  createEvaluationContext,
  evaluatePlayer,
  type EvaluationTeam,
  type EvaluationFactor,
} from "./teamEvaluation";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type Pokemon,
  type Roster,
  type RosterSlot,
  type Tactic,
} from "./types";
export interface DraftRecommendation {
  pokemonId: number;
  slot: RosterSlot;
  fit: number;
  score: number;
  reasons: string[];
  alternatives: number[];
  scarceAlternatives: number;
  physical: string;
  factors?: EvaluationFactor[];
}
/** Advice scores roster fit, not a forecast of a CPU's future picks. */
export function recommendRosterPicks(
  pool: Pokemon[],
  roster: Roster,
  tactic: Tactic,
  limit = 3,
  team?: EvaluationTeam,
): DraftRecommendation[] {
  const used = new Set(Object.values(roster));
  const vacancies = ROSTER_SLOTS.filter((s) => roster[s] == null);
  if (!vacancies.length) return [];
  const starters = POSITIONS.filter((p) => roster[p] == null);
  const available = pool.filter((p) => !used.has(p.id));
  if (team?.evaluationVersion === 1) {
    const context = createEvaluationContext({ ...team, roster, tactic });
    const positions = starters.length ? starters : [...POSITIONS];
    const evaluations = new Map(
      positions.map((position) => [
        position,
        available
          .map((mon) => evaluatePlayer(context, mon.id, position))
          .sort((a, b) => b.score - a.score || a.pokemonId - b.pokemonId),
      ]),
    );
    return available
      .map((mon) => {
        const best = positions
          .map((position) =>
            evaluations.get(position)!.find((p) => p.pokemonId === mon.id)!,
          )
          .sort((a, b) => b.score - a.score)[0];
        const rivals = evaluations
          .get(best.role)!
          .filter((p) => p.pokemonId !== mon.id);
        const scarceAlternatives = rivals.filter(
          (p) => p.score >= best.score - 4,
        ).length;
        return {
          pokemonId: mon.id,
          slot: starters.length ? best.role : vacancies[0],
          fit: best.roleFit,
          score: best.score,
          factors: best.factors,
          reasons: [
            `Shared team value: ${best.score.toFixed(1)}; ${starters.length ? `${best.role} vacancy` : `bench depth at ${best.role}`}.`,
            ...best.reasons,
            `${scarceAlternatives} other available players are within 4 team-value points or better at ${best.role}.`,
          ],
          alternatives: rivals.slice(0, 2).map((p) => p.pokemonId),
          scarceAlternatives,
          physical: `${mon.heightM} m · ${mon.weightKg} kg. Size helps reach and contact; mobility and stamina still matter.`,
        };
      })
      .sort((a, b) => b.score - a.score || a.pokemonId - b.pokemonId)
      .slice(0, Math.max(0, Math.floor(limit)));
  }
  const current = [...used]
    .flatMap((id) => (id == null ? [] : [POKEMON_BY_ID.get(id)!]))
    .filter(Boolean)
    .map((p) => playerProfile(p).attributes);
  const needs = (["passing", "threePoint", "interiorDefense"] as const).map(
    (key) => ({
      key,
      average: current.length
        ? current.reduce((n, p) => n + p[key], 0) / current.length
        : 60,
    }),
  );
  const descriptions = {
    passing: "Adds passing to a roster that needs creation",
    threePoint: "Adds shooting to improve spacing",
    interiorDefense: "Adds interior defense to protect the rim",
  };
  return available
    .map((mon) => {
      const profile = playerProfile(mon),
        a = profile.attributes;
      const positions = starters.length ? starters : [...POSITIONS];
      const position = positions.reduce((best, p) =>
        profile.positions[p] > profile.positions[best] ? p : best,
      );
      const slot = starters.length ? position : vacancies[0];
      const fit = profile.positions[position];
      const style =
        tactic === "perimeter"
          ? a.threePoint
          : tactic === "interior"
            ? (a.finishing + a.offensiveRebound) / 2
            : tactic === "pace"
              ? (a.speed + a.stamina) / 2
              : tactic === "defense"
                ? (a.perimeterDefense + a.interiorDefense) / 2
                : a.composure;
      const complements = needs
        .map((n) => ({
          ...n,
          gain:
            (Math.max(0, 65 - n.average) * Math.max(0, a[n.key] - n.average)) /
            100,
        }))
        .sort((x, y) => y.gain - x.gain);
      const rivals = available
        .filter((p) => p.id !== mon.id)
        .map((p) => ({ id: p.id, fit: playerProfile(p).positions[position] }))
        .sort((x, y) => y.fit - x.fit || x.id - y.id);
      const scarceAlternatives = rivals.filter((p) => p.fit >= fit - 4).length;
      const reasons = [
        starters.length
          ? `${position} vacancy: ${fit.toFixed(0)} position fit`
          : `Bench depth: strongest fit at ${position} (${fit.toFixed(0)})`,
        `${style.toFixed(0)} fit with your ${tactic} offense`,
      ];
      if (current.length && complements[0].gain > 0.2)
        reasons.push(descriptions[complements[0].key]);
      reasons.push(
        `${scarceAlternatives} other available players are within 4 rating points or better at ${position}`,
      );
      return {
        pokemonId: mon.id,
        slot,
        fit,
        score: fit * 0.8 + style * 0.15 + complements[0].gain,
        reasons,
        alternatives: rivals.slice(0, 2).map((p) => p.id),
        scarceAlternatives,
        physical: `${mon.heightM} m · ${mon.weightKg} kg. Size helps reach and contact; mobility and stamina still matter.`,
      };
    })
    .sort((a, b) => b.score - a.score || a.pokemonId - b.pokemonId)
    .slice(0, Math.max(0, Math.floor(limit)));
}
