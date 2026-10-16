/** League-wide box-score rates for one court engine version.
 * Reproduce: node scripts/court-metrics.mjs --court=2 --games=600 */
import { createServer } from "vite";
const arg = (name, fallback) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.split("=")[1] ??
  fallback;
const court =
  arg("court", "2") === "none" ? undefined : Number(arg("court", "2"));
const games = Number(arg("games", 600));
const legends = arg("legends", "false") === "true";
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: "custom",
  logLevel: "error",
});
try {
  const { simulateMatch } = await server.ssrLoadModule("/src/game/match.ts"),
    { createRun } = await server.ssrLoadModule("/src/game/draft.ts"),
    { createLeague } = await server.ssrLoadModule("/src/game/league.ts");
  const run = createRun("free", legends, 9824);
  const clubs = createLeague({
    ...run,
    roster: {
      PG: 65,
      SG: 135,
      SF: 149,
      PF: 68,
      C: 143,
      B1: 121,
      B2: 6,
      B3: 131,
    },
  }).map((c) => ({ ...c, courtVersion: court }));
  const t = {
    poss: 0,
    pts: 0,
    fga: 0,
    fgm: 0,
    tpa: 0,
    tpm: 0,
    fta: 0,
    tov: 0,
    ast: 0,
    stl: 0,
    fouls: 0,
    foulOuts: 0,
    orb: 0,
    drb: 0,
    homeWins: 0,
    ot: 0,
    margin: 0,
    blowouts: 0,
    close: 0,
  };
  const started = performance.now();
  for (let i = 0; i < games; i++) {
    const home = clubs[i % 30],
      away = clubs[((i % 30) + 1 + (i % 29)) % 30];
    const m = simulateMatch(home, away, 512000 + i);
    t.poss += m.possessions;
    t.homeWins += Number(m.homeScore > m.awayScore);
    t.ot += Number(m.overtimePeriods > 0);
    const d = Math.abs(m.homeScore - m.awayScore);
    t.margin += d;
    t.blowouts += Number(d >= 20);
    t.close += Number(d <= 5);
    for (const box of [m.homeBox, m.awayBox])
      for (const p of box) {
        t.pts += p.points;
        t.fga += p.fga;
        t.fgm += p.fgm;
        t.tpa += p.threePA;
        t.tpm += p.threePM;
        t.fta += p.fta;
        t.tov += p.turnovers;
        t.ast += p.assists;
        t.stl += p.steals;
        t.fouls += p.fouls;
        t.foulOuts += Number(p.fouls >= 6);
        t.orb += p.offensiveRebounds ?? 0;
        t.drb += p.defensiveRebounds ?? 0;
      }
  }
  const teamGames = games * 2,
    r = (x, d = 3) => Number(x.toFixed(d));
  const possessionsPerGame = t.poss / games;
  console.log(
    JSON.stringify(
      {
        courtVersion: court ?? "none",
        games,
        pace: r(possessionsPerGame, 1),
        pointsPerTeam: r(t.pts / teamGames, 1),
        fgPct: r(t.fgm / t.fga),
        threeRate: r(t.tpa / t.fga),
        threePct: r(t.tpm / t.tpa),
        ftRate: r(t.fta / t.fga),
        tovPct: r(t.tov / (t.fga + 0.44 * t.fta + t.tov)),
        turnoversPerTeam: r(t.tov / teamGames, 2),
        stealsPerTeam: r(t.stl / teamGames, 2),
        assistedPct: r(t.ast / t.fgm),
        assistsPerTeam: r(t.ast / teamGames, 1),
        foulsPerTeam: r(t.fouls / teamGames, 1),
        foulOutsPerGame: r(t.foulOuts / games),
        orbPct: r(t.orb / (t.orb + t.drb)),
        homeWinPct: r(t.homeWins / games),
        overtimePct: r(t.ot / games),
        avgMargin: r(t.margin / games, 1),
        blowout20Pct: r(t.blowouts / games),
        within5Pct: r(t.close / games),
        msPerGame: r((performance.now() - started) / games, 1),
      },
      null,
      1,
    ),
  );
} finally {
  await server.close();
}
