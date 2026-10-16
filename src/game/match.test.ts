import { describe, expect, it } from "vitest";
import { simulateMatch } from "./match";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import { teamRatings } from "./ratings";
import {
  ROSTER_SLOTS,
  type LeagueBox,
  type LeagueTeam,
  type Roster,
} from "./types";

const IDS = [65, 135, 149, 68, 143, 121, 6, 131];
function team(
  id: number,
  ids = IDS,
  changes: Partial<LeagueTeam> = {},
): LeagueTeam {
  const roster = Object.fromEntries(
    ROSTER_SLOTS.map((slot, i) => [slot, ids[i]]),
  ) as Roster;
  return {
    id,
    name: `Team ${id}`,
    roster,
    tactic: "balanced",
    rotation: "balanced",
    defense: "man",
    ratings: teamRatings(roster),
    ...changes,
  };
}
const sum = (box: LeagueBox[], key: keyof LeagueBox) =>
  box.reduce((total, p) => total + Number(p[key]), 0);

describe("symmetric five-on-five match simulation", () => {
  it("conserves minutes, scoring, plus/minus and rebound opportunities on both sides", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const match = simulateMatch(
        team(0),
        team(1, [9, 59, 94, 103, 76, 80, 112, 130]),
        seed,
      );
      expect(match.homeScore).not.toBe(match.awayScore);
      expect(match.periods).toHaveLength(4 + match.overtimePeriods);
      expect(match.periods.reduce((n, p) => n + p.home, 0)).toBe(
        match.homeScore,
      );
      expect(match.periods.reduce((n, p) => n + p.away, 0)).toBe(
        match.awayScore,
      );
      for (const [box, opponent, score, against, id] of [
        [match.homeBox, match.awayBox, match.homeScore, match.awayScore, 0],
        [match.awayBox, match.homeBox, match.awayScore, match.homeScore, 1],
      ] as const) {
        expect(box).toHaveLength(8);
        expect(box.filter((p) => p.started)).toHaveLength(5);
        expect(sum(box, "minutes")).toBe(240 + 25 * match.overtimePeriods);
        expect(sum(box, "points")).toBe(score);
        expect(sum(box, "plusMinus")).toBe(5 * (score - against));
        expect(sum(box, "steals")).toBeLessThanOrEqual(
          sum(opponent, "turnovers"),
        );
        expect(sum(box, "blocks")).toBeLessThanOrEqual(
          sum(opponent, "fga") - sum(opponent, "fgm"),
        );
        expect(sum(box, "fta")).toBeLessThanOrEqual(sum(opponent, "fouls") * 4);
        expect(sum(box, "assists")).toBeLessThanOrEqual(sum(box, "fgm"));
        const missedFgs = sum(box, "fga") - sum(box, "fgm");
        const rebounds =
          sum(box, "offensiveRebounds") + sum(opponent, "defensiveRebounds");
        expect(rebounds).toBeGreaterThanOrEqual(missedFgs);
        expect(rebounds).toBeLessThanOrEqual(
          missedFgs + sum(box, "fta") - sum(box, "ftm"),
        );
        for (const p of box) {
          expect(p.teamId).toBe(id);
          expect(p.playerId).toBe(`${id}:${p.pokemonId}`);
          expect(p.points).toBe(2 * p.fgm + p.threePM + p.ftm);
          expect(p.fgm).toBe(p.rimFgm + p.midFgm + p.threePM);
          expect(p.fga).toBe(p.rimFga + p.midFga + p.threePA);
          expect(p.fgm).toBeLessThanOrEqual(p.fga);
          expect(p.ftm).toBeLessThanOrEqual(p.fta);
          expect(p.minutes).toBeLessThanOrEqual(48 + 5 * match.overtimePeriods);
        }
      }
    }
  });

  it("replays the seed exactly without mutating team configuration", () => {
    const home = team(0),
      away = team(1);
    const before = JSON.stringify([home, away]);
    expect(simulateMatch(home, away, 42)).toEqual(
      simulateMatch(home, away, 42),
    );
    expect(JSON.stringify([home, away])).toBe(before);
    expect(simulateMatch(home, away, 43)).not.toEqual(
      simulateMatch(home, away, 42),
    );
  });

  it("plays tied regulation games into genuine five-minute overtime", () => {
    const games = Array.from({ length: 160 }, (_, i) =>
      simulateMatch(team(0), team(1), i + 500),
    );
    const overtime = games.filter((g) => g.overtimePeriods > 0);
    expect(overtime.length).toBeGreaterThan(0);
    for (const game of overtime) {
      expect(
        game.periods.slice(0, 4).reduce((n, p) => n + p.home - p.away, 0),
      ).toBe(0);
      expect(game.homeScore).not.toBe(game.awayScore);
      expect(sum(game.homeBox, "minutes")).toBe(
        240 + game.overtimePeriods * 25,
      );
      expect(sum(game.awayBox, "minutes")).toBe(
        240 + game.overtimePeriods * 25,
      );
    }
  });

  it("gives equal rosters a modest home edge without making either side a synthetic opponent", () => {
    let margin = 0,
      wins = 0;
    const home = team(0),
      away = team(1);
    for (let seed = 1000; seed < 1300; seed++) {
      const game = simulateMatch(home, away, seed);
      margin += game.homeScore - game.awayScore;
      wins += Number(game.homeScore > game.awayScore);
    }
    expect(margin / 300).toBeGreaterThan(-1);
    expect(margin / 300).toBeLessThan(7);
    expect(wins / 300).toBeGreaterThan(0.43);
    expect(wins / 300).toBeLessThan(0.72);
  });

  it("changes shot selection, tempo and actual rotation minutes with coaching choices", () => {
    let perimeterThrees = 0,
      interiorThrees = 0,
      interiorRim = 0,
      perimeterRim = 0;
    let fastPossessions = 0,
      slowPossessions = 0,
      heavyStarterMinutes = 0,
      deepStarterMinutes = 0;
    for (let seed = 100; seed < 140; seed++) {
      const perimeter = simulateMatch(
        team(0, IDS, { tactic: "perimeter" }),
        team(1),
        seed,
      );
      const interior = simulateMatch(
        team(0, IDS, { tactic: "interior" }),
        team(1),
        seed,
      );
      const fast = simulateMatch(
        team(0, IDS, { tactic: "pace", rotation: "starters" }),
        team(1),
        seed,
      );
      const slow = simulateMatch(
        team(0, IDS, { tactic: "defense", rotation: "bench" }),
        team(1),
        seed,
      );
      perimeterThrees += sum(perimeter.homeBox, "threePA");
      interiorThrees += sum(interior.homeBox, "threePA");
      interiorRim += sum(interior.homeBox, "rimFga");
      perimeterRim += sum(perimeter.homeBox, "rimFga");
      fastPossessions += fast.possessions;
      slowPossessions += slow.possessions;
      heavyStarterMinutes += sum(
        fast.homeBox.filter((p) => p.started),
        "minutes",
      );
      deepStarterMinutes += sum(
        slow.homeBox.filter((p) => p.started),
        "minutes",
      );
    }
    expect(perimeterThrees - interiorThrees).toBeGreaterThan(40 * 8);
    expect(interiorRim - perimeterRim).toBeGreaterThan(40 * 5);
    expect(fastPossessions - slowPossessions).toBeGreaterThan(40 * 5);
    expect(heavyStarterMinutes - deepStarterMinutes).toBeGreaterThan(40 * 10);
  });

  it("rejects invalid rosters instead of creating imaginary players", () => {
    expect(() => simulateMatch(team(0, IDS.slice(0, 5)), team(1), 1)).toThrow(
      /eight|roster/i,
    );
    expect(() => simulateMatch(team(0, Array(8).fill(65)), team(1), 1)).toThrow(
      /unique|roster/i,
    );
  });

  it("uses closeout skill to contest perimeter shots", () => {
    // Isolate the derived closeout tool: all twenty base skills stay identical.
    const profiles = IDS.map((id) => playerProfile(POKEMON_BY_ID.get(id)!));
    const original = profiles.map((p) => p.traits.closeout);
    const offense = team(0, IDS, { tactic: "perimeter" }),
      defense = team(1);
    const scoring = (closeout: number) => {
      profiles.forEach((p) => {
        p.traits.closeout = closeout;
      });
      let points = 0;
      for (let seed = 700; seed < 800; seed++)
        points += simulateMatch(offense, defense, seed).homeScore;
      return points;
    };
    try {
      expect(scoring(10) - scoring(95)).toBeGreaterThan(100 * 2);
    } finally {
      profiles.forEach((p, i) => {
        p.traits.closeout = original[i];
      });
    }
  });

  it("makes a press create turnovers and fouls, while a zone invites more threes", () => {
    let manTurnovers = 0,
      pressTurnovers = 0,
      manFouls = 0,
      pressFouls = 0,
      manThrees = 0,
      zoneThrees = 0;
    for (let seed = 200; seed < 260; seed++) {
      const man = simulateMatch(team(0), team(1), seed);
      const press = simulateMatch(
        team(0, IDS, { defense: "press" }),
        team(1),
        seed,
      );
      const zone = simulateMatch(
        team(0, IDS, { defense: "zone" }),
        team(1),
        seed,
      );
      manTurnovers += sum(man.awayBox, "turnovers");
      pressTurnovers += sum(press.awayBox, "turnovers");
      manFouls += sum(man.homeBox, "fouls");
      pressFouls += sum(press.homeBox, "fouls");
      manThrees += sum(man.awayBox, "threePA");
      zoneThrees += sum(zone.awayBox, "threePA");
    }
    expect(pressTurnovers - manTurnovers).toBeGreaterThan(60);
    expect(pressFouls - manFouls).toBeGreaterThan(60);
    expect(zoneThrees - manThrees).toBeGreaterThan(60 * 2);
  });

  it("rewards bench recovery when otherwise identical players have poor stamina", () => {
    // Eight equal players eliminate the confound of stronger bench talent.
    const source = POKEMON_BY_ID.get(65)!;
    const ids = Array.from({ length: 8 }, (_, i) => 900 + i);
    for (const id of ids)
      POKEMON_BY_ID.set(id, {
        ...source,
        id,
        stats: { ...source.stats, hp: 1, speed: 1, specialDefense: 20 },
      });
    try {
      const heavy = team(0, ids, { rotation: "starters" }),
        deep = team(0, ids, { rotation: "bench" }),
        opponent = team(1, ids);
      let heavyPoints = 0,
        deepPoints = 0;
      for (let seed = 100; seed < 350; seed++) {
        heavyPoints += simulateMatch(heavy, opponent, seed).homeScore;
        deepPoints += simulateMatch(deep, opponent, seed).homeScore;
      }
      expect(deepPoints - heavyPoints).toBeGreaterThan(250);
    } finally {
      for (const id of ids) POKEMON_BY_ID.delete(id);
    }
  });

  it("keeps five players and real scoring when foul-outs deplete the roster", () => {
    const home = team(0, [150, 151, 149, 146, 145, 144, 68, 143], {
      tactic: "interior",
      defense: "press",
    });
    const away = team(1, [10, 13, 11, 14, 129, 19, 16, 41], {
      tactic: "pace",
      defense: "press",
    });
    let depleted;
    for (let seed = 1; seed <= 1200 && !depleted; seed++) {
      const match = simulateMatch(home, away, seed);
      if (match.awayBox.some((p) => p.fouls > 6)) depleted = match;
    }
    expect(depleted).toBeDefined();
    expect(
      depleted!.awayBox.filter((p) => p.fouls >= 6).length,
    ).toBeGreaterThanOrEqual(4);
    expect(sum(depleted!.awayBox, "minutes")).toBe(
      240 + 25 * depleted!.overtimePeriods,
    );
    expect(sum(depleted!.homeBox, "points")).toBe(depleted!.homeScore);
    expect(sum(depleted!.homeBox, "plusMinus")).toBe(
      (depleted!.homeScore - depleted!.awayScore) * 5,
    );
    expect(sum(depleted!.awayBox, "plusMinus")).toBe(
      (depleted!.awayScore - depleted!.homeScore) * 5,
    );
  });
});
