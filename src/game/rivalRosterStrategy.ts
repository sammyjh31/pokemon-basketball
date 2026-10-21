import { shinyPokemon } from "./shiny";
import { POKEMON_BY_ID } from "../data/pokemon";
import { clamp, positionRating } from "./ratings";
import { typeMatchup } from "./typeMatchups";
import { POSITIONS, ROSTER_SLOTS, type LeagueTeam } from "./types";
import type { RivalHistory } from "./rivalScoutingTypes";
export interface RivalPriority {
  teamId: number;
  name: string;
  games: number;
  losses: number;
  threatIds: number[];
}
export interface RivalStrategy {
  active: boolean;
  rivals: RivalPriority[];
  /** Cheap, cached individual value for the trade candidate shortlist. */
  playerValue(id: number): number;
  score(ids: readonly number[]): number;
  change(outgoing: readonly number[], incoming: readonly number[]): number;
  tradeChange(
    outgoing: readonly number[],
    incoming: readonly number[],
    partnerTeamId: number,
  ): number;
  explanation: string;
}
interface Threat {
  teamId: number;
  id: number;
  weight: number;
}
/** Recruiting uses only completed, recent encounters and opponents' current players.
 * This is a small roster preference, never a replacement for basketball valuation. */
export function createRivalStrategy(
  team: LeagueTeam,
  teams: readonly LeagueTeam[],
  history: readonly RivalHistory[],
  year: number,
): RivalStrategy {
  const current = new Map(teams.map((t) => [t.id, t]));
  const observations = new Map<
    number,
    {
      importance: number;
      games: number;
      losses: number;
      freshness: number;
      threats: Map<number, number>;
    }
  >();
  for (const archive of history) {
    const age = year - archive.year;
    if (age < 0 || age > 2 || archive.rivalScouting?.version !== 1) continue;
    const recency = 0.6 ** age;
    for (const rival of archive.rivalScouting.teams[team.id] ?? []) {
      const opponent = current.get(rival.teamId);
      if (!opponent || opponent.id === team.id) continue;
      const owned = new Set(Object.values(opponent.roster));
      const threats = rival.threats.filter(
        (t) => owned.has(t.pokemonId) && t.attempts > 0,
      );
      if (!threats.length) continue;
      const confidence = Math.min(1, rival.games / 4);
      const importance =
        recency *
        confidence *
        (1 + rival.losses / rival.games + Math.min(1, rival.playoffGames / 4));
      const row = observations.get(rival.teamId) ?? {
        importance: 0,
        games: 0,
        losses: 0,
        freshness: 0,
        threats: new Map<number, number>(),
      };
      row.importance += importance;
      row.games += rival.games;
      row.losses += rival.losses;
      row.freshness = Math.max(row.freshness, recency * confidence);
      const production = threats.reduce(
        (sum, t) => sum + t.points + t.attempts * 0.25,
        0,
      );
      for (const threat of threats) {
        const weight =
          ((importance * (threat.points + threat.attempts * 0.25)) /
            production) *
          Math.min(1, threat.attempts / 20);
        row.threats.set(
          threat.pokemonId,
          (row.threats.get(threat.pokemonId) ?? 0) + weight,
        );
      }
      observations.set(rival.teamId, row);
    }
  }
  const selected = [...observations]
    .sort((a, b) => b[1].importance - a[1].importance || a[0] - b[0])
    .slice(0, 3);
  const importance = selected.reduce((sum, [, r]) => sum + r.importance, 0);
  const threats: Threat[] = [];
  const rivals = selected.map(([id, r]) => {
    const top = [...r.threats]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 3);
    for (const [pokemonId, weight] of top)
      threats.push({
        teamId: id,
        id: pokemonId,
        weight: (weight / importance) * r.freshness,
      });
    return {
      teamId: id,
      name: current.get(id)!.name,
      games: r.games,
      losses: r.losses,
      threatIds: top.map(([pokemonId]) => pokemonId),
    };
  });
  const development = new Map(
    teams.flatMap((t) =>
      Object.entries(t.development ?? {}).map(
        ([id, value]) => [Number(id), value] as const,
      ),
    ),
  );
  const values = new Map<number, number[]>();
  const vector = (id: number) => {
    const cached = values.get(id);
    if (cached) return cached;
    const mon = POKEMON_BY_ID.get(id);
    const skill = mon
      ? clamp(
          Math.max(
            ...POSITIONS.map((p) =>
              positionRating(
                shinyPokemon(mon, team.shinySeed),
                p,
                development.get(id),
              ),
            ),
          ) / 90,
          0.3,
          1,
        )
      : 0;
    const result = threats.map((t) => {
      const target = POKEMON_BY_ID.get(t.id);
      return mon && target
        ? skill *
            (0.45 * typeMatchup(mon.types, target.types).edge -
              0.55 * typeMatchup(target.types, mon.types).edge)
        : 0;
    });
    values.set(id, result);
    return result;
  };
  const roster = ROSTER_SLOTS.map((slot) => team.roster[slot]!).filter(Boolean);
  const portfolio = (ids: readonly number[], excluded = new Set<number>()) => {
    const distinct = [...new Set(ids)];
    return threats.reduce((sum, threat, index) => {
      if (excluded.has(index)) return sum;
      const options = distinct
        .map((id) => vector(id)[index])
        .sort((a, b) => b - a);
      // A starter and an alternative matter. Redundant third counters add no bonus.
      return (
        sum +
        2 *
          threat.weight *
          (0.65 * (options[0] ?? 0) + 0.35 * (options[1] ?? options[0] ?? 0))
      );
    }, 0);
  };
  const after = (out: readonly number[], incoming: readonly number[]) => [
    ...roster.filter((id) => !out.includes(id)),
    ...incoming,
  ];
  const baseline = portfolio(roster);
  return {
    active: threats.length > 0,
    rivals,
    playerValue: (id) =>
      vector(id).reduce(
        (sum, value, index) => sum + 2 * threats[index].weight * value,
        0,
      ),
    score: (ids) => portfolio(ids),
    change: (out, incoming) =>
      clamp(portfolio(after(out, incoming)) - baseline, -3, 3),
    tradeChange: (out, incoming, partnerId) => {
      // A scorer acquired from a rival is no longer a threat on that rival.
      const excluded = new Set(
        threats.flatMap((t, i) =>
          t.teamId === partnerId && incoming.includes(t.id) ? [i] : [],
        ),
      );
      return clamp(
        portfolio(after(out, incoming), excluded) - portfolio(roster, excluded),
        -3,
        3,
      );
    },
    explanation: rivals.length
      ? `Rival scouting: ${rivals.map((r) => `${r.name} (${r.games} meetings; ${r.threatIds.map((id) => POKEMON_BY_ID.get(id)!.name).join(", ")})`).join("; ")}. Recent seasons carry more weight.`
      : "",
  };
}
