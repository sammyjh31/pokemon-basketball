import { createServer } from "vite";
const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", logLevel: "error" });
const L = (p) => server.ssrLoadModule(p);
const { createRun } = await L("/src/game/draft.ts"), { createLeague } = await L("/src/game/league.ts"), { simulateSeason } = await L("/src/game/season.ts"), { developPlayer } = await L("/src/game/development.ts");
const base = createRun("free", process.argv[2] === "true", 9824);
const roster = { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 };
const res = simulateSeason({ ...base, roster });
const rows = res.league.players.filter(p => p.minutes > 300).map(p => developPlayer(p, {}, 1, 5, undefined, false));
const n = rows.length, mx = rows.reduce((a, r) => a + r.before, 0) / n, my = rows.reduce((a, r) => a + r.impactPer36, 0) / n;
let sxy = 0, sxx = 0; for (const r of rows) { sxy += (r.before - mx) * (r.impactPer36 - my); sxx += (r.before - mx) ** 2; }
const b = sxy / sxx; console.log("n", n, "slope", b.toFixed(3), "intercept", (my - b * mx).toFixed(2), "mean before", mx.toFixed(1), "mean impact36", my.toFixed(2));
for (const lo of [30, 45, 55, 65, 75]) { const g = rows.filter(r => r.before >= lo && r.before < lo + 10); if (g.length) console.log(lo, g.length, "impact36", (g.reduce((a, r) => a + r.impactPer36, 0) / g.length).toFixed(1), "expected", (lo + 5) * 0.75 - 12, "mpg", (g.reduce((a, r) => a + r.minutesPerGame, 0) / g.length).toFixed(1)); }
await server.close();
