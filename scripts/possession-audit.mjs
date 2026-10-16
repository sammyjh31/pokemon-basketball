/** Reproducible tuning evidence: node scripts/possession-audit.mjs [--samples=100] */
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
const samples = Number(
  process.argv.find((a) => a.startsWith("--samples="))?.split("=")[1] ?? 100,
);
if (!Number.isInteger(samples) || samples < 20 || samples > 1000)
  throw Error("samples must be 20..1000");
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
try {
  const { simulateMatch } = await server.ssrLoadModule("/src/game/match.ts");
  const { createRun } = await server.ssrLoadModule("/src/game/draft.ts");
  const { createLeague } = await server.ssrLoadModule("/src/game/league.ts");
  const teams = createLeague({
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
  const sum = (rows, key) => rows.reduce((n, p) => n + p[key], 0),
    mean = (xs) =>
      Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3));
  const results = [];
  for (const version of [undefined, 1])
    for (const tactic of [
      "balanced",
      "pace",
      "interior",
      "perimeter",
      "defense",
    ]) {
      const data = [];
      for (let i = 0; i < samples; i++) {
        const h = { ...teams[i % 30], possessionVersion: version, tactic };
        const a = {
          ...teams[((i % 29) + 1 + (i % 30)) % 30],
          possessionVersion: version,
        };
        const m = simulateMatch(h, a, 818100 + i),
          p = m.insights?.possession;
        for (const [side, team, other] of [
          ["home", h, a],
          ["away", a, h],
        ]) {
          const box = m[side + "Box"],
            score = m[side + "Score"];
          if (
            sum(box, "points") !== score ||
            sum(box, "minutes") !== 240 + 25 * m.overtimePeriods
          )
            throw Error("Accounting failure");
          if (side === "home")
            data.push({
              score,
              allowed: m.awayScore,
              orb: sum(box, "offensiveRebounds"),
              turnovers: sum(box, "turnovers"),
              assists: sum(box, "assists"),
              fga: sum(box, "fga"),
              fgm: sum(box, "fgm"),
              fta: sum(box, "fta"),
              transition:
                p?.teams.find((t) => t.teamId === team.id).transitionPoints ??
                0,
              breaksAllowed:
                p?.teams.find((t) => t.teamId === other.id).transitionPoints ??
                0,
              second:
                p?.teams.find((t) => t.teamId === team.id).secondChancePoints ??
                0,
            });
        }
      }
      results.push({
        rules: version ?? "legacy",
        tactic,
        samples,
        ...Object.fromEntries(
          Object.keys(data[0]).map((k) => [k, mean(data.map((r) => r[k]))]),
        ),
      });
    }
  const output = {
    seed: 818100,
    games: samples * 10,
    note: "Tuning evidence from fixed seeded matchups, not empirical basketball calibration. Legacy did not record transition/second-chance points; zeros there mean unavailable.",
    results,
  };
  await writeFile(
    "docs/possession-balance-audit.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(JSON.stringify(output, null, 2));
} finally {
  await server.close();
}
