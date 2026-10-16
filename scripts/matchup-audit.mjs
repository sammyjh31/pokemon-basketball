/** Reproduce: node scripts/matchup-audit.mjs --samples=100 */
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
const samples = Number(
  process.argv.find((a) => a.startsWith("--samples="))?.split("=")[1] ?? 100,
);
if (!Number.isInteger(samples) || samples < 20 || samples > 1000)
  throw Error("samples must be 20..1000");
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: "custom",
  logLevel: "error",
});
try {
  const { simulateMatch } = await server.ssrLoadModule("/src/game/match.ts");
  const { createRun } = await server.ssrLoadModule("/src/game/draft.ts");
  const { createLeague } = await server.ssrLoadModule("/src/game/league.ts");
  const teams = createLeague({
    ...createRun("free", true, 9824),
    courtVersion: undefined,
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
        const h = { ...teams[i % 30], matchupVersion: version, tactic };
        const a = {
          ...teams[((i % 29) + 1 + (i % 30)) % 30],
          matchupVersion: version,
        };
        const m = simulateMatch(h, a, 618100 + i),
          shots =
            m.insights?.shots.filter((s) => s.offenseTeamId === h.id) ?? [];
        for (const side of ["home", "away"]) {
          const boxes = m[side + "Box"];
          if (
            sum(boxes, "points") !== m[side + "Score"] ||
            sum(boxes, "minutes") !== 240 + 25 * m.overtimePeriods
          )
            throw Error("Accounting failure");
        }
        if (
          m.homeScore === m.awayScore ||
          m.homeScore > 250 ||
          m.awayScore > 250
        )
          throw Error("Unresolved or extreme score");
        data.push({
          score: m.homeScore,
          allowed: m.awayScore,
          win: Number(m.homeScore > m.awayScore),
          orb: sum(m.homeBox, "offensiveRebounds"),
          turnovers: sum(m.homeBox, "turnovers"),
          blocks: sum(m.homeBox, "blocks"),
          fouls: sum(m.homeBox, "fouls"),
          fta: sum(m.homeBox, "fta"),
          postPlays: m.plays.post.home,
          pickRolls: m.plays.pickRoll.home,
          advantageRate:
            shots.filter((s) => s.matchup?.won).length /
            Math.max(1, shots.length),
          postSeals: shots.filter((s) => s.matchup?.action === "post seal")
            .length,
        });
      }
      results.push({
        rules: version ?? "previous",
        tactic,
        samples,
        ...Object.fromEntries(
          Object.keys(data[0]).map((k) => [k, mean(data.map((r) => r[k]))]),
        ),
      });
    }
  const { bodyProfile, resolveBodyMatchup, matchupPreference } =
    await server.ssrLoadModule("/src/game/bodyMatchups.ts");
  const { POKEMON_BY_ID } = await server.ssrLoadModule("/src/data/pokemon.ts");
  const { playerProfile } = await server.ssrLoadModule(
    "/src/game/playerProfile.ts",
  );
  const mon = POKEMON_BY_ID.get(25),
    profile = playerProfile(mon);
  const actor = (heightM, weightKg, types = ["normal"]) => ({
    body: bodyProfile({ ...mon, heightM, weightKg }),
    profile,
    energy: 100,
    types,
  });
  const guard = actor(1.5, 80),
    controlled = [];
  for (const [name, a, d] of [
    ["light attacking", actor(1.5, 20), guard],
    ["heavy attacking", actor(1.5, 400), guard],
    ["light defending", guard, actor(1.5, 20)],
    ["heavy defending", guard, actor(1.5, 400)],
    ["fire into grass", actor(1.5, 80, ["fire"]), actor(1.5, 80, ["grass"])],
    ["fire into water", actor(1.5, 80, ["fire"]), actor(1.5, 80, ["water"])],
  ]) {
    controlled.push({
      name,
      skills: "identical",
      postAdvantage: resolveBodyMatchup(
        a,
        d,
        { play: "post", zone: "rim", coverage: "man" },
        0,
      ).advantageChance,
      driveAdvantage: resolveBodyMatchup(
        a,
        d,
        { play: "isolation", zone: "rim", coverage: "man" },
        0,
      ).advantageChance,
      postPreference: matchupPreference(a, d, "post"),
      isolationPreference: matchupPreference(a, d, "isolation"),
    });
  }
  const output = {
    seed: 618100,
    games: samples * 10,
    note: "Fictional tuning, not empirical basketball calibration. Same seeds and rosters across models; differences in action sequences mean this is not an isolated causal treatment. Controlled cases hold all basketball skills constant. Previous rules do not record advantage/seal telemetry; zeros mean unavailable.",
    results,
    controlled,
  };
  await writeFile(
    "docs/matchup-balance-audit.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(JSON.stringify(output, null, 2));
} finally {
  await server.close();
}
