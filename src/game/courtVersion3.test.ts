import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { bodyProfile, reboundBody } from "./bodyMatchups";
import { developPlayer } from "./development";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { addBox, leagueHonors, leaguePlayers } from "./leagueStats";
import { simulateMatch } from "./match";
import type { CourtVersion } from "./courtTypes";
import type { LeagueTeam, Standing } from "./types";

const roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: 121,
  B2: 6,
  B3: 131,
};
/**
 * `current: false` reproduces version-1/2 saves made before abilities, chemistry,
 * evaluation, chemistry growth, morale and personalities; comparisons between court versions keep every other current flag on.
 */
const clubs = (
  seed: number,
  courtVersion: CourtVersion,
  current = courtVersion === 3,
): LeagueTeam[] => {
  const run = { ...createRun("free", true, seed), roster };
  if (!current) {
    delete run.abilityMasteryVersion;
    delete run.abilityVersion;
    delete run.physicalAbilityVersion;
    delete run.chemistryVersion;
    delete run.evaluationVersion;
    delete run.chemistryGrowthVersion;
    delete run.moraleVersion;
    delete run.personalityVersion;
  }
  return createLeague(run).map((t) => ({ ...t, courtVersion }));
};
const digest = (rows: unknown[]) => {
  const hash = createHash("sha256");
  for (const row of rows) hash.update(JSON.stringify(row));
  return hash.digest("hex");
};
/** A cheap partial season: every club plays four games. */
function sample(version: CourtVersion) {
  const teams = clubs(4242, version),
    players = leaguePlayers(teams),
    byId = new Map(players.map((p) => [p.playerId, p])),
    standings: Standing[] = teams.map((t) => ({
      teamId: t.id,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      homeWins: 0,
      awayWins: 0,
      streak: 0,
      lastTen: 0,
    }));
  for (let i = 0; i < 60; i++) {
    const h = i % 30,
      a = (h + 1 + (i % 7)) % 30,
      m = simulateMatch(teams[h], teams[a], 7700 + i);
    for (const box of [...m.homeBox, ...m.awayBox])
      addBox(byId.get(box.playerId)!, box, m.playerOfGameId);
    standings[h].wins += Number(m.homeScore > m.awayScore);
    standings[h].losses += Number(m.homeScore < m.awayScore);
    standings[a].wins += Number(m.awayScore > m.homeScore);
    standings[a].losses += Number(m.awayScore < m.homeScore);
  }
  return { teams, players, standings };
}

it("leaves version-2 court results byte-identical for saved replays", () => {
  const teams = clubs(31337, 2);
  expect(
    digest(
      Array.from({ length: 60 }, (_, i) =>
        simulateMatch(teams[i % 30], teams[(i + 11) % 30], 99 + i),
      ),
    ),
  ).toBe("69811a1af793a01016d20779918e8840e493215eb26e303a27006e7bc4c929f3");
});

it("leaves version-2 development and honors byte-identical", () => {
  const { players, standings } = sample(2);
  expect(digest(players.map((p) => developPlayer(p, {}, 2, 9001)))).toBe(
    "4f1ff9a4f37ba35e0d3d1d823ab1e32877a3c992691dfe9abb6c613932e2e710",
  );
  expect(digest([leagueHonors(players, standings, 4)])).toBe(
    "5047c53696459a370486bddf3aa938f2c9bf952167966efe872ac41444cb5f73",
  );
});

it("saturates body size under version 3 without reordering species", () => {
  const wailord = POKEMON_BY_ID.get(321) ?? POKEMON_BY_ID.get(130)!,
    pikachu = POKEMON_BY_ID.get(25)!,
    raw = [bodyProfile(wailord), bodyProfile(pikachu)],
    soft = [bodyProfile(wailord, true), bodyProfile(pikachu, true)];
  expect(soft[0].reach - soft[1].reach).toBeLessThan(
    (raw[0].reach - raw[1].reach) * 0.85,
  );
  expect(soft[0].reach).toBeGreaterThan(soft[1].reach);
  expect(soft[0].mass).toBeGreaterThan(soft[1].mass);
  expect(Math.abs(reboundBody(soft[0], false, true))).toBeLessThanOrEqual(4);
  expect(reboundBody(raw[0], false)).toBeGreaterThan(4);
});

it("spreads rebounds beyond one designated crasher under version 3", () => {
  const leaders = (version: CourtVersion) => {
    const teams = clubs(9824, version, true);
    let top = 0,
      total = 0,
      orbTop = 0,
      orb = 0;
    for (let i = 0; i < 60; i++) {
      const m = simulateMatch(teams[i % 30], teams[(i + 7) % 30], 600 + i);
      for (const box of [m.homeBox, m.awayBox]) {
        const boards = box.map(
          (p) => p.offensiveRebounds + p.defensiveRebounds,
        );
        top += Math.max(...boards);
        total += boards.reduce((a, b) => a + b, 0);
        orbTop += Math.max(...box.map((p) => p.offensiveRebounds));
        orb += box.reduce((n, p) => n + p.offensiveRebounds, 0);
      }
    }
    return { topShare: top / total, orbTopShare: orbTop / orb, total };
  };
  const v2 = leaders(2),
    v3 = leaders(3);
  expect(v3.topShare).toBeLessThan(v2.topShare - 0.03);
  expect(v3.orbTopShare).toBeLessThan(v2.orbTopShare - 0.08);
  // Team rebounding volume is unchanged; only who collects them moves.
  expect(Math.abs(v3.total - v2.total) / v2.total).toBeLessThan(0.05);
});

it("closes version-3 margins with score-state effort and garbage time", () => {
  const sample = (version: CourtVersion) => {
    const teams = clubs(9824, version, true);
    let margin = 0,
      blowouts = 0,
      overtime = 0,
      reserveMinutes = 0;
    const games = 120;
    for (let i = 0; i < games; i++) {
      const m = simulateMatch(
        teams[i % 30],
        teams[((i % 30) + 1 + (i % 29)) % 30],
        512000 + i,
      );
      const d = Math.abs(m.homeScore - m.awayScore);
      margin += d;
      blowouts += Number(d >= 20);
      overtime += Number(m.overtimePeriods > 0);
      for (const p of [...m.homeBox, ...m.awayBox])
        if (p.slot.startsWith("B")) reserveMinutes += p.minutes;
    }
    return {
      margin: margin / games,
      blowouts: blowouts / games,
      overtime: overtime / games,
      reserveMinutes,
    };
  };
  const v2 = sample(2),
    v3 = sample(3);
  expect(v3.margin).toBeLessThan(v2.margin - 2);
  expect(v3.margin).toBeGreaterThan(9);
  expect(v3.margin).toBeLessThan(14);
  expect(v3.blowouts).toBeLessThan(v2.blowouts);
  expect(v3.blowouts).toBeLessThan(0.24);
  expect(v3.overtime).toBeGreaterThanOrEqual(v2.overtime);
  // Decided games hand minutes to the reserves.
  expect(v3.reserveMinutes).toBeGreaterThan(v2.reserveMinutes);
});
