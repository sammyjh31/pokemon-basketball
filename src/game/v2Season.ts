// Frozen model 2: keep old eight-player seasons reproducible.
import { OPPONENTS, SCHEDULE } from "./v2Opponents";
import { POKEMON_BY_ID } from "../data/pokemon";
import { attributes, clamp, rotationMinutes, teamRatings } from "./v2Ratings";
import { nextRandom } from "./random";
import { aggregateStats, emptyBox, impact, seasonAwards } from "./v2Boxscore";
import {
  ROSTER_SLOTS,
  type Attributes,
  type GameResult,
  type Opponent,
  type PlayerBox,
  type Run,
  type SeasonResult,
  type TeamRatings,
} from "./types";
// Retained for old save validation; new games derive winners from possession scores.
export { resolveScore } from "./legacySeason";
export const SEASON_RULES = {
  homeAdvantage: 1.75,
  probabilityScale: 9,
  minProbability: 0.01,
  maxProbability: 0.999,
};
export function winProbability(
  team: TeamRatings,
  opponent: Opponent,
  home: boolean,
): number {
  const difference =
    (team.offense - opponent.defense + team.defense - opponent.offense) / 2 +
    (home ? 1 : -1) * SEASON_RULES.homeAdvantage;
  return clamp(
    1 / (1 + Math.exp(-difference / SEASON_RULES.probabilityScale)),
    0.01,
    0.999,
  );
}
interface Player {
  box: PlayerBox;
  skill: Attributes;
  minutes: number;
  fatigue: number;
}
export function simulateSeason(run: Run): SeasonResult {
  const team = teamRatings(run.roster, run.tactic, run.rotation);
  if (!team.complete || new Set(Object.values(run.roster)).size !== 8)
    throw new Error("Draft eight distinct players first.");
  if (run.result) throw new Error("This roster has already played its season.");
  let seed = run.seasonSeed;
  const roll = () => {
    const n = nextRandom(seed);
    seed = n.seed;
    return n.value;
  };
  const rotation = rotationMinutes(run.roster, run.rotation);
  const base = ROSTER_SLOTS.map((slot) => ({
    slot,
    id: run.roster[slot]!,
    skill: attributes(POKEMON_BY_ID.get(run.roster[slot]!)!),
  }));
  const rotationSkill = (key: keyof Attributes) =>
    base.reduce((sum, p) => sum + p.skill[key] * rotation[p.slot], 0) / 240;
  const offensiveBoards = rotationSkill("offensiveRebound"),
    defensiveBoards = rotationSkill("defensiveRebound");
  const paceBonus =
    run.tactic === "pace" ? 9 : run.tactic === "defense" ? -5 : 0;
  const games: GameResult[] = SCHEDULE.map((match) => {
    const opponent = OPPONENTS[match.opponentId - 1],
      home = match.home ? 1 : -1;
    const possessions = Math.round(
      clamp(98 + opponent.pace + paceBonus + (roll() - 0.5) * 10, 82, 120),
    );
    const players: Player[] = base.map((p) => ({
      box: { ...emptyBox(p.id, p.slot), minutes: rotation[p.slot] },
      skill: p.skill,
      minutes: rotation[p.slot],
      fatigue:
        Math.max(0, rotation[p.slot] - (24 + p.skill.stamina * 0.14)) *
        (1 + Math.max(0, paceBonus) / 15),
    }));
    const weighted = (
      weight: (p: Player) => number,
      exclude?: Player,
    ): Player => {
      const eligible = players.filter((p) => p !== exclude),
        weights = eligible.map((p) => Math.max(0.01, p.minutes * weight(p)));
      let target = roll() * weights.reduce((s, n) => s + n, 0);
      return (
        eligible.find((_p, i) => {
          target -= weights[i];
          return target <= 0;
        }) ?? eligible[eligible.length - 1]
      );
    };
    const pickSkill = (key: keyof Attributes) =>
      weighted((p) => Math.max(1, p.skill[key]) ** 1.5);
    const shootingWeight = (p: Player) =>
      ((0.4 * p.skill.finishing +
        0.35 * p.skill.shooting +
        0.25 * p.skill.ballHandling) /
        50) **
      2;
    let opponentScore = 0;
    const offensiveRebound = (chance: number) => {
      if (
        chance < 2 &&
        roll() < clamp(0.22 + (offensiveBoards - 50) * 0.002, 0.13, 0.34)
      ) {
        pickSkill("offensiveRebound").box.offensiveRebounds++;
        return true;
      }
      return false;
    };
    const opponentRebound = (chance: number) => {
      if (
        chance < 2 &&
        roll() < clamp(0.25 - (defensiveBoards - 50) * 0.002, 0.12, 0.36)
      )
        return true;
      pickSkill("defensiveRebound").box.defensiveRebounds++;
      return false;
    };
    const freeThrows = (p: Player, count: number) => {
      let finalMade = false;
      for (let i = 0; i < count; i++) {
        p.box.fta++;
        finalMade =
          roll() < clamp(0.48 + p.skill.freeThrow * 0.0046, 0.42, 0.96);
        if (finalMade) {
          p.box.ftm++;
          p.box.points++;
        }
      }
      return finalMade;
    };
    const ours = () => {
      const p = weighted(shootingWeight),
        a = p.skill;
      const turnover = clamp(
        0.18 -
          a.ballHandling * 0.0011 -
          a.composure * 0.0003 +
          (opponent.defense - 50) * 0.00065 +
          p.fatigue * 0.0015,
        0.045,
        0.24,
      );
      if (roll() < turnover) {
        p.box.turnovers++;
        return;
      }
      for (let chance = 0; chance < 3; chance++) {
        const threeRate = clamp(
          0.1 +
            a.threePoint * 0.004 +
            (run.tactic === "perimeter"
              ? 0.22
              : run.tactic === "interior"
                ? -0.2
                : 0),
          0.07,
          0.78,
        );
        const three = roll() < threeRate;
        const atRim =
          !three && roll() < (run.tactic === "interior" ? 0.8 : 0.62);
        const foulRate = three
          ? 0.025
          : 0.09 + a.strength * 0.0007 + (atRim ? 0.04 : 0);
        if (roll() < foulRate) {
          const finalMade = freeThrows(p, three ? 3 : 2);
          if (!finalMade && offensiveRebound(chance)) continue;
          return;
        }
        p.box.fga++;
        if (three) p.box.threePA++;
        const skill = three ? a.threePoint : atRim ? a.finishing : a.midRange;
        const probability = clamp(
          (three ? 0.285 : 0.45) +
            (skill - 45) * (three ? 0.0023 : 0.0035) -
            (opponent.defense - 50) * (three ? 0.0015 : 0.0024) +
            (team.spacing ?? 50) * 0.00025 +
            (team.creation ?? 50) * 0.0003 +
            (team.offense - 55) * 0.0012 +
            home * 0.007 -
            p.fatigue * 0.002,
          0.16,
          three ? 0.58 : 0.78,
        );
        if (roll() < probability) {
          p.box.fgm++;
          if (three) p.box.threePM++;
          p.box.points += three ? 3 : 2;
          if (roll() < clamp(0.32 + (team.creation ?? 50) * 0.004, 0.35, 0.8))
            weighted((q) => q.skill.passing ** 2, p).box.assists++;
          return;
        }
        if (offensiveRebound(chance)) continue;
        return;
      }
    };
    const theirs = () => {
      const defender = pickSkill("perimeterDefense");
      if (
        roll() <
        clamp(0.12 + (team.defense - opponent.offense) * 0.0015, 0.055, 0.23)
      ) {
        if (roll() < 0.62) pickSkill("steal").box.steals++;
        return;
      }
      for (let chance = 0; chance < 3; chance++) {
        const three =
          roll() <
          (opponent.style === "Run & gun"
            ? 0.46
            : opponent.style === "Inside out"
              ? 0.22
              : 0.34);
        if (roll() < (three ? 0.025 : 0.16)) {
          let finalMade = false;
          for (let i = 0; i < (three ? 3 : 2); i++) {
            finalMade =
              roll() < clamp(0.65 + opponent.offense * 0.002, 0.6, 0.88);
            if (finalMade) opponentScore++;
          }
          if (!finalMade && opponentRebound(chance)) continue;
          return;
        }
        const rimDefender = pickSkill("block");
        const blocked =
          roll() < clamp(0.015 + rimDefender.skill.block * 0.0008, 0.02, 0.11);
        if (blocked) rimDefender.box.blocks++;
        const defensiveSkill = three
          ? defender.skill.perimeterDefense
          : (team.rimProtection ?? team.defense);
        const probability = clamp(
          (three ? 0.32 : 0.47) +
            (opponent.offense - 50) * (three ? 0.002 : 0.0035) -
            (defensiveSkill - 50) * 0.0014 -
            (team.defense - 50) * 0.001 -
            home * 0.007,
          0.18,
          three ? 0.55 : 0.75,
        );
        if (!blocked && roll() < probability) {
          opponentScore += three ? 3 : 2;
          return;
        }
        if (opponentRebound(chance)) continue;
        return;
      }
    };
    const play = (count: number) => {
      for (let n = 0; n < count; n++) {
        ours();
        theirs();
      }
    };
    play(possessions);
    const teamScore = () => players.reduce((sum, p) => sum + p.box.points, 0);
    let overtimePeriods = 0;
    while (teamScore() === opponentScore) {
      overtimePeriods++;
      play(10);
      // Largest-remainder allocation conserves 25 additional player-minutes per OT.
      const shares = players.map((p) => (25 * p.minutes) / 240),
        extra = shares.map(Math.floor);
      const order = shares
        .map((v, i) => ({ i, remainder: v - extra[i] }))
        .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
      for (
        let i = 0, left = 25 - extra.reduce((s, n) => s + n, 0);
        i < left;
        i++
      )
        extra[order[i].i]++;
      players.forEach((p, i) => {
        p.box.minutes += extra[i];
      });
    }
    const boxScore = players.map((p) => p.box);
    const playerOfGameId = [...boxScore].sort(
      (a, b) => impact(b) - impact(a) || a.pokemonId - b.pokemonId,
    )[0].pokemonId;
    return {
      ...match,
      winProbability: winProbability(team, opponent, match.home),
      teamScore: teamScore(),
      opponentScore,
      won: teamScore() > opponentScore,
      overtime: overtimePeriods > 0,
      overtimePeriods,
      possessions: possessions + 10 * overtimePeriods,
      playerOfGameId,
      boxScore,
    };
  });
  const wins = games.filter((g) => g.won).length,
    playerStats = aggregateStats(games),
    awards = seasonAwards(playerStats);
  return {
    modelVersion: 2,
    games,
    wins,
    losses: 82 - wins,
    mvpId: awards[0].pokemonId,
    playerStats,
    awards,
  };
}
