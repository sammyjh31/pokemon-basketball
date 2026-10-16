// Frozen model 2: keep old eight-player seasons reproducible.
import type {
  GameResult,
  PlayerBox,
  RosterSlot,
  SeasonAward,
  SeasonPlayer,
} from "./types";
export const COUNTING_STATS = [
  "minutes",
  "points",
  "offensiveRebounds",
  "defensiveRebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "fgm",
  "fga",
  "threePM",
  "threePA",
  "ftm",
  "fta",
] as const;
export function emptyBox(pokemonId: number, slot: RosterSlot): PlayerBox {
  return {
    pokemonId,
    slot,
    minutes: 0,
    points: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fgm: 0,
    fga: 0,
    threePM: 0,
    threePA: 0,
    ftm: 0,
    fta: 0,
  };
}
export const rebounds = (p: PlayerBox) =>
  p.offensiveRebounds + p.defensiveRebounds;
export const impact = (p: PlayerBox) =>
  p.points +
  1.2 * rebounds(p) +
  1.5 * p.assists +
  3 * p.steals +
  3 * p.blocks -
  1.5 * p.turnovers -
  0.4 * (p.fga - p.fgm) -
  0.4 * (p.fta - p.ftm);
export function aggregateStats(games: GameResult[]): SeasonPlayer[] {
  const players = new Map<number, SeasonPlayer>();
  for (const game of games)
    for (const box of game.boxScore ?? []) {
      let p = players.get(box.pokemonId);
      if (!p) {
        p = {
          ...emptyBox(box.pokemonId, box.slot),
          gamesPlayed: 0,
          gamesStarted: 0,
          doubleDoubles: 0,
          tripleDoubles: 0,
          highPoints: 0,
          playerOfGame: 0,
        };
        players.set(p.pokemonId, p);
      }
      for (const key of COUNTING_STATS) p[key] += box[key];
      if (box.minutes > 0) {
        p.gamesPlayed++;
        if (!box.slot.startsWith("B")) p.gamesStarted++;
      }
      const doubles = [
        box.points,
        rebounds(box),
        box.assists,
        box.steals,
        box.blocks,
      ].filter((n) => n >= 10).length;
      p.doubleDoubles += Number(doubles >= 2);
      p.tripleDoubles += Number(doubles >= 3);
      p.highPoints = Math.max(p.highPoints, box.points);
      p.playerOfGame += Number(game.playerOfGameId === p.pokemonId);
    }
  return [...players.values()];
}
export function seasonAwards(players: SeasonPlayer[]): SeasonAward[] {
  const award = (
    id: SeasonAward["id"],
    title: string,
    description: string,
    score: (p: SeasonPlayer) => number,
    value: (p: SeasonPlayer) => string,
    pool = players,
  ): SeasonAward => {
    const winner = [...pool].sort(
      (a, b) => score(b) - score(a) || a.pokemonId - b.pokemonId,
    )[0];
    return {
      id,
      title,
      description,
      pokemonId: winner.pokemonId,
      value: value(winner),
    };
  };
  const avg = (n: number, p: SeasonPlayer) =>
    (n / Math.max(1, p.gamesPlayed)).toFixed(1);
  return [
    award(
      "mvp",
      "Most Valuable Player",
      "Production across scoring, creation and defense, minus turnovers and missed shots.",
      impact,
      (p) =>
        `${avg(p.points, p)} PPG · ${avg(rebounds(p), p)} RPG · ${avg(p.assists, p)} APG`,
    ),
    award(
      "defense",
      "Defensive Player",
      "Blocks, steals and defensive rebounds across the season.",
      (p) => 2 * p.steals + 2.5 * p.blocks + 0.45 * p.defensiveRebounds,
      (p) => `${avg(p.steals, p)} SPG · ${avg(p.blocks, p)} BPG`,
    ),
    award(
      "sixth",
      "Sixth Player",
      "The most productive reserve by the same impact formula as MVP.",
      impact,
      (p) => `${avg(p.points, p)} PPG off the bench`,
      players.filter((p) => p.gamesStarted < p.gamesPlayed / 2),
    ),
    award(
      "scoring",
      "Scoring Leader",
      "Most total points for your team.",
      (p) => p.points,
      (p) => `${p.points} PTS · ${avg(p.points, p)} PPG`,
    ),
    award(
      "playmaking",
      "Playmaker",
      "Most total assists for your team.",
      (p) => p.assists,
      (p) => `${p.assists} AST · ${avg(p.assists, p)} APG`,
    ),
    award(
      "rebounding",
      "Rebounding Leader",
      "Most offensive and defensive rebounds combined.",
      rebounds,
      (p) => `${rebounds(p)} REB · ${avg(rebounds(p), p)} RPG`,
    ),
  ];
}
