/** Reproduce: node scripts/coach-audit.mjs. Checks all 32 styles on two fixed matchups. */
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: "custom",
  logLevel: "error",
});
try {
  const { simulateMatch } = await server.ssrLoadModule("/src/game/match.ts");
  const { createRun } = await server.ssrLoadModule("/src/game/draft.ts");
  const { createLeague } = await server.ssrLoadModule("/src/game/league.ts");
  const { COACHES } = await server.ssrLoadModule("/src/game/trainerCoaches.ts");
  const clubs = createLeague({
    ...createRun("free", true, 882),
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
  const rows = [];
  let games = 0,
    adjustments = 0;
  for (const coach of COACHES) {
    const row = { coach: coach.name, scores: [], minutes: [], coverages: {} };
    for (let i = 0; i < 2; i++) {
      const h = { ...clubs[i * 7], coach: { version: 1, id: coach.id } },
        a = {
          ...clubs[15 + i],
          coach: { version: 1, id: coach.id === "mom" ? "ash" : "mom" },
        };
      const m = simulateMatch(h, a, 711 + i),
        compact = simulateMatch(h, a, 711 + i, { collectInsights: false });
      if (
        JSON.stringify({ ...m, insights: undefined }) !==
        JSON.stringify(compact)
      )
        throw Error("Report-dependent result");
      for (const side of ["home", "away"]) {
        const b = m[side + "Box"];
        if (
          b.reduce((n, p) => n + p.points, 0) !== m[side + "Score"] ||
          Math.abs(
            b.reduce((n, p) => n + p.minutes, 0) -
              (240 + 25 * m.overtimePeriods),
          ) > 1e-7 ||
          b.filter((p) => p.started).length !== 5
        )
          throw Error("Broken score/minutes/starters");
      }
      row.scores.push([m.homeScore, m.awayScore]);
      row.minutes.push(m.homeBox.map((p) => Number(p.minutes.toFixed(2))));
      for (const seq of m.insights.court ?? [])
        if (seq.coverage)
          row.coverages[seq.coverage] = (row.coverages[seq.coverage] ?? 0) + 1;
      adjustments += m.insights.adjustments.length;
      games++;
    }
    rows.push(row);
  }
  const report = {
    games,
    styles: COACHES.length,
    adjustments,
    allAccountingChecksPassed: true,
    compactParity: true,
    rows,
  };
  await writeFile(
    new URL("../docs/coach-balance-audit.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      games,
      styles: report.styles,
      adjustments,
      allAccountingChecksPassed: true,
      compactParity: true,
    }),
  );
} finally {
  await server.close();
}
