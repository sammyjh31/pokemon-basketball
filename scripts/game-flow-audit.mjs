/** Reproduce: node scripts/game-flow-audit.mjs --samples=300 */
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
const samples = Number(
  process.argv.find((v) => v.startsWith("--samples="))?.split("=")[1] ?? 300,
);
if (!Number.isInteger(samples) || samples < 30 || samples > 3000)
  throw Error("samples must be 30..3000");
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: "custom",
  logLevel: "error",
});
try {
  const { simulateMatch } = await server.ssrLoadModule("/src/game/match.ts"),
    { createRun } = await server.ssrLoadModule("/src/game/draft.ts"),
    { createLeague } = await server.ssrLoadModule("/src/game/league.ts");
  const clubs = createLeague({
    ...createRun("free", true, 9824),
    coach: { version: 1, id: "misty" },
    roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
  });
  const legacy = clubs.map((club) => {
    const copy = { ...club };
    delete copy.gameFlowVersion;
    return copy;
  });
  const mean = (v) =>
    v.length ? Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(3)) : null;
  const regular = (home, away) => ({
    stage: "regular",
    rest: { home, away },
    trip: { home: 0, away: 1 },
  });
  const playoff = (game, homeWins, awayWins) => ({
    stage: "playoff",
    rest: { home: 1, away: 1 },
    trip: { home: 0, away: 1 },
    playoff: {
      round: 1,
      game,
      homeWins,
      awayWins,
      winsNeeded: 4,
      ...(game > 1 ? { previous: { winnerId: -1, margin: 6 } } : {}),
    },
  });
  const scenarios = [
    { name: "Without game flow", teams: legacy },
    { name: "Regular season, rested", teams: clubs, flow: regular(2, 2) },
    { name: "Home team on a back-to-back", teams: clubs, flow: regular(0, 2) },
    { name: "Away team on a back-to-back", teams: clubs, flow: regular(2, 0) },
    { name: "Playoffs, Game 3", teams: clubs, flow: playoff(3, 1, 1) },
    { name: "Playoffs, Game 7", teams: clubs, flow: playoff(7, 3, 3) },
  ];
  const results = [];
  const schemes = {},
    depth = { cut: 0, drift: 0, seal: 0, games: 0, hotFga: 0, hotFgm: 0, fga: 0, fgm: 0 };
  for (const scenario of scenarios) {
    const rows = [],
      crews = {},
      started = performance.now();
    for (let i = 0; i < samples; i++) {
      const home = scenario.teams[i % 30],
        away = scenario.teams[((i % 30) + 1 + (i % 29)) % 30];
      const m = simulateMatch(home, away, 913400 + i, {
        ...(scenario.flow ? { flow: scenario.flow } : {}),
      });
      const fouls = [...m.homeBox, ...m.awayBox].reduce((n, b) => n + b.fouls, 0);
      const fta = [...m.homeBox, ...m.awayBox].reduce((n, b) => n + b.fta, 0);
      const bench = [m.homeBox, m.awayBox].map(
        (box) => [...box].sort((a, b) => a.minutes - b.minutes)[0].minutes,
      );
      rows.push({
        points: (m.homeScore + m.awayScore) / 2,
        possessions: m.possessions,
        fouls: fouls / 2,
        fta: fta / 2,
        homeWin: Number(m.homeScore > m.awayScore),
        overtime: Number(m.overtimePeriods > 0),
        margin: Math.abs(m.homeScore - m.awayScore),
        timeouts: (m.gameFlow?.timeouts.length ?? 0) / 2,
        eighthManMinutes: (bench[0] + bench[1]) / 2,
      });
      if (m.gameFlow) {
        const crew = m.gameFlow.referee.label;
        (crews[crew] ??= []).push(fouls / 2);
      }
      if (m.gameFlow?.hotShots && scenario.flow?.stage === "regular") {
        depth.games++;
        for (const seq of m.insights.court)
          for (const a of seq.actions)
            if (a.kind in depth && a.kind !== "games") depth[a.kind]++;
        for (const shot of m.gameFlow.hotShots) {
          depth.hotFga += shot.attempts;
          depth.hotFgm += shot.made;
        }
        for (const b of [...m.homeBox, ...m.awayBox]) {
          depth.fga += b.fga;
          depth.fgm += b.fgm;
        }
        // Opponent shot profile and offensive rebounding against each opening scheme.
        for (const plan of m.insights.coaches ?? []) {
          const offense = plan.teamId === m.homeBox[0].teamId ? m.awayBox : m.homeBox;
          const defense = plan.teamId === m.homeBox[0].teamId ? m.homeBox : m.awayBox;
          const row = (schemes[plan.defense] ??= {
            games: 0,
            points: 0,
            fga: 0,
            threes: 0,
            rim: 0,
            offensiveRebounds: 0,
            defensiveRebounds: 0,
          });
          row.games++;
          for (const b of offense) {
            row.points += b.points;
            row.fga += b.fga;
            row.threes += b.threePA;
            row.rim += b.rimFga;
            row.offensiveRebounds += b.offensiveRebounds;
          }
          for (const b of defense) row.defensiveRebounds += b.defensiveRebounds;
        }
      }
    }
    const pick = (key) => mean(rows.map((r) => r[key]));
    results.push({
      scenario: scenario.name,
      games: samples,
      pointsPerTeam: pick("points"),
      possessions: pick("possessions"),
      foulsPerTeam: pick("fouls"),
      ftaPerTeam: pick("fta"),
      homeWinRate: pick("homeWin"),
      overtimeRate: pick("overtime"),
      averageMargin: pick("margin"),
      timeoutsPerTeam: pick("timeouts"),
      eighthManMinutes: pick("eighthManMinutes"),
      foulsPerTeamByCrew: Object.fromEntries(
        Object.entries(crews).map(([k, v]) => [k, { games: v.length, fouls: mean(v) }]),
      ),
      msPerGame: Number(((performance.now() - started) / samples).toFixed(2)),
    });
  }
  const playDepth = {
    perGame: Object.fromEntries(
      ["cut", "drift", "seal"].map((k) => [k, mean([depth[k] / Math.max(1, depth.games)])]),
    ),
    hotFgPct: mean([depth.hotFgm / Math.max(1, depth.hotFga)]),
    allFgPct: mean([depth.fgm / Math.max(1, depth.fga)]),
    hotShareOfAttempts: mean([depth.hotFga / Math.max(1, depth.fga)]),
    opponentsByOpeningScheme: Object.fromEntries(
      Object.entries(schemes).map(([scheme, r]) => [
        scheme,
        {
          teamGames: r.games,
          pointsAllowed: mean([r.points / r.games]),
          threeRate: mean([r.threes / r.fga]),
          rimRate: mean([r.rim / r.fga]),
          offensiveReboundRate: mean([
            r.offensiveRebounds / (r.offensiveRebounds + r.defensiveRebounds),
          ]),
        },
      ]),
    ),
  };
  const report = {
    generated: "scripts/game-flow-audit.mjs",
    samples,
    note: "Descriptive game-design tuning, not an empirical fit to real basketball.",
    results,
    playDepth,
  };
  await writeFile("docs/game-flow-audit.json", JSON.stringify(report, null, 2) + "\n");
  console.table(
    results.map(({ foulsPerTeamByCrew, ...row }) => row),
  );
  for (const r of results)
    if (Object.keys(r.foulsPerTeamByCrew).length)
      console.log(r.scenario, JSON.stringify(r.foulsPerTeamByCrew));
  console.log(JSON.stringify(playDepth, null, 2));
} finally {
  await server.close();
}
