/** Reproduce: node scripts/court-audit.mjs --samples=100 */
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
const samples = Number(
  process.argv.find((v) => v.startsWith("--samples="))?.split("=")[1] ?? 100,
);
if (!Number.isInteger(samples) || samples < 20 || samples > 1000)
  throw Error("samples must be 20..1000");
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
  });
  const mean = (v) =>
      Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(3)),
    results = [];
  for (const version of [undefined, 1])
    for (const tactic of [
      "balanced",
      "pace",
      "interior",
      "perimeter",
      "defense",
    ]) {
      const rows = [],
        coverages = {},
        started = performance.now();
      for (let i = 0; i < samples; i++) {
        const home = { ...clubs[i % 30], courtVersion: version, tactic },
          away = {
            ...clubs[((i % 30) + 1 + (i % 29)) % 30],
            courtVersion: version,
          };
        const m = simulateMatch(home, away, 712100 + i);
        for (const side of ["home", "away"]) {
          const boxes = m[side + "Box"];
          if (
            boxes.reduce((n, p) => n + p.points, 0) !== m[side + "Score"] ||
            Math.abs(
              boxes.reduce((n, p) => n + p.minutes, 0) -
                (240 + 25 * m.overtimePeriods),
            ) > 1e-7
          )
            throw Error("Accounting mismatch");
          if (!Number.isFinite(m[side + "Score"]) || m[side + "Score"] > 250)
            throw Error("Nonfinite/extreme score");
        }
        if (m.homeScore === m.awayScore) throw Error("Unresolved tie");
        const seq = m.insights?.court ?? [];
        for (const s of seq) {
          if (!(
            s.seconds > 0 &&
            s.seconds <= s.initialClock + 1e-8 &&
            s.shotClock >= 0
          ))
            throw Error("Clock bounds");
          const periodEnd =
            s.period <= 4 ? s.period * 720 : 2880 + (s.period - 4) * 300;
          if (s.elapsedSeconds + s.seconds > periodEnd + 1e-7)
            throw Error("Period overrun");
          if (s.coverage)
            coverages[s.coverage] = (coverages[s.coverage] ?? 0) + 1;
        }
        rows.push({
          points: m.homeScore,
          allowed: m.awayScore,
          possessions: m.possessions,
          win: Number(m.homeScore > m.awayScore),
          turnovers: m.homeBox.reduce((n, p) => n + p.turnovers, 0),
          threes: m.homeBox.reduce((n, p) => n + p.threePA, 0),
          multi: seq.filter(
            (s) =>
              s.actions.filter((a) =>
                ["screen", "drive", "pass", "kickout", "reset"].includes(
                  a.kind,
                ),
              ).length >= 2,
          ).length,
          late: seq.filter(
            (s) =>
              s.actions.some((a) => a.kind === "shoot") && s.shotClock <= 4,
          ).length,
          violations: seq.filter((s) => s.outcome === "violation").length,
        });
      }
      results.push({
        courtVersion: version ?? "previous body engine",
        tactic,
        games: samples,
        ...Object.fromEntries(
          Object.keys(rows[0]).map((k) => [k, mean(rows.map((r) => r[k]))]),
        ),
        coverages,
        milliseconds: Math.round(performance.now() - started),
      });
    }
  const output = {
    note: "Seeded fictional tuning smoke test across 30 rosters. Rates are descriptive, not real basketball calibration or an optimal strategy search. All score, minute and clock assertions passed.",
    games: samples * 10,
    results,
  };
  await writeFile(
    "docs/court-balance-audit.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(JSON.stringify(output, null, 2));
} finally {
  await server.close();
}
