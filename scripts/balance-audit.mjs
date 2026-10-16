/** Run with: node scripts/balance-audit.mjs [--samples=200] [--out=path.json]
 * Deterministic game-tuning audit. Not fitted to real basketball outcomes.
 */
import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
const samples = Number(
  process.argv.find((a) => a.startsWith("--samples="))?.split("=")[1] ?? 200,
);
if (!Number.isInteger(samples) || samples < 20 || samples > 2000)
  throw new Error("samples must be 20..2000");
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
try {
  const { simulateMatch } = await server.ssrLoadModule("/src/game/match.ts");
  const { engineProfile } = await server.ssrLoadModule(
    "/src/game/engineDepth.ts",
  );
  const { POKEMON_BY_ID } = await server.ssrLoadModule("/src/data/pokemon.ts");
  const { teamRatings } = await server.ssrLoadModule("/src/game/ratings.ts");
  const { ROSTER_SLOTS } = await server.ssrLoadModule("/src/game/types.ts");
  const { nextRandom } = await server.ssrLoadModule("/src/game/random.ts");
  const baseIds = [65, 135, 149, 68, 143, 121, 6, 131];
  const rules = {
    version: 1,
    abilities: true,
    adaptiveCoaching: false,
    familiarity: 0.4,
  };
  const team = (id, options = {}) => {
    const { ids = baseIds, ...changes } = options;
    const roster = Object.fromEntries(ROSTER_SLOTS.map((s, i) => [s, ids[i]]));
    return {
      id,
      name: String(id),
      roster,
      tactic: "balanced",
      rotation: "balanced",
      defense: "man",
      ratings: teamRatings(roster),
      simulationVersion: 2,
      engineRules: rules,
      ...changes,
    };
  };
  let simulations = 0;
  const run = (home, away, i) => {
    simulations++;
    return simulateMatch(home, away, 424200 + i);
  };
  const sum = (box, key) => box.reduce((n, p) => n + p[key], 0);
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  const rounded = (value) => Math.round(value * 10000) / 10000;
  const distribution = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      mean: rounded(mean(values)),
      min: sorted[0],
      p10: sorted[Math.floor(sorted.length * 0.1)],
      median: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      max: sorted.at(-1),
    };
  };
  const baseline = Array.from({ length: samples }, (_, i) =>
    run(team(0), team(1), i),
  );
  const model2 = Array.from({ length: samples }, (_, i) =>
    run(
      team(0, { engineRules: undefined }),
      team(1, { engineRules: undefined }),
      i,
    ),
  );
  const totalFga = baseline.reduce(
    (n, g) => n + sum(g.homeBox, "fga") + sum(g.awayBox, "fga"),
    0,
  );
  const totalFgPoints = baseline.reduce(
    (n, g) =>
      n +
      g.homeScore +
      g.awayScore -
      sum(g.homeBox, "ftm") -
      sum(g.awayBox, "ftm"),
    0,
  );
  const telemetry = baseline.flatMap((g) => g.insights.shots);
  const ordinary = telemetry.filter((s) => !s.foul);
  const expected = mean(ordinary.map((s) => s.expectedProbability));
  const actual = mean(ordinary.map((s) => Number(s.made)));
  const styles = [];
  for (const tactic of [
    "balanced",
    "pace",
    "perimeter",
    "interior",
    "defense",
  ]) {
    const games = Array.from({ length: samples }, (_, i) =>
      run(team(0, { tactic }), team(1), i),
    );
    styles.push({
      tactic,
      homeWinRate: rounded(
        mean(games.map((g) => Number(g.homeScore > g.awayScore))),
      ),
      points: rounded(mean(games.map((g) => g.homeScore))),
      possessions: rounded(mean(games.map((g) => g.possessions))),
      threeAttempts: rounded(mean(games.map((g) => sum(g.homeBox, "threePA")))),
      rimAttempts: rounded(mean(games.map((g) => sum(g.homeBox, "rimFga")))),
    });
  }
  const pairedTreatment = (label, treatment, control) => {
    const margins = [],
      wins = [],
      rebounds = [],
      points = [];
    for (let i = 0; i < samples; i++) {
      const home = run(team(0, treatment), team(1, control), i),
        away = run(team(0, control), team(1, treatment), i);
      margins.push(
        (home.homeScore - home.awayScore + away.awayScore - away.homeScore) / 2,
      );
      wins.push(
        (Number(home.homeScore > home.awayScore) +
          Number(away.awayScore > away.homeScore)) /
          2,
      );
      rebounds.push(
        (sum(home.homeBox, "offensiveRebounds") -
          sum(home.awayBox, "offensiveRebounds") +
          sum(away.awayBox, "offensiveRebounds") -
          sum(away.homeBox, "offensiveRebounds")) /
          2,
      );
      points.push((home.homeScore + away.awayScore) / 2);
    }
    return {
      label,
      pairedMeanMargin: rounded(mean(margins)),
      treatmentWinRate: rounded(mean(wins)),
      meanOffensiveReboundDifference: rounded(mean(rebounds)),
      treatmentPoints: rounded(mean(points)),
    };
  };
  const catalogIds = [...POKEMON_BY_ID.keys()];
  let catalogSeed = 714200;
  const randomRoster = () => {
    const selected = [];
    while (selected.length < 8) {
      const next = nextRandom(catalogSeed);
      catalogSeed = next.seed;
      const id = catalogIds[Math.floor(next.value * catalogIds.length)];
      if (!selected.includes(id)) selected.push(id);
    }
    return selected;
  };
  const catalogGames = Array.from({ length: samples }, (_, i) =>
    run(team(0, { ids: randomRoster() }), team(1, { ids: randomRoster() }), i),
  );
  const abilities = pairedTreatment(
    "Abilities on versus off",
    { engineRules: rules },
    { engineRules: { ...rules, abilities: false } },
  );
  const continuity = pairedTreatment(
    "Familiarity 1 versus 0",
    { engineRules: { ...rules, familiarity: 1 } },
    { engineRules: { ...rules, familiarity: 0 } },
  );
  const adaptive = pairedTreatment(
    "Adaptive versus fixed coaching",
    { engineRules: { ...rules, adaptiveCoaching: true }, tactic: "perimeter" },
    { engineRules: rules, tactic: "perimeter" },
  );
  // Equal source stats/types isolate physical dimensions (derived ratings + depth effects).
  const base = POKEMON_BY_ID.get(65),
    smallIds = [],
    largeIds = [];
  for (let i = 0; i < 8; i++) {
    smallIds.push(5001 + i);
    largeIds.push(5101 + i);
    POKEMON_BY_ID.set(5001 + i, {
      ...base,
      id: 5001 + i,
      heightM: 0.5,
      weightKg: 15,
    });
    POKEMON_BY_ID.set(5101 + i, {
      ...base,
      id: 5101 + i,
      heightM: 3,
      weightKg: 300,
    });
  }
  const physical = pairedTreatment(
    "3m/300kg versus 0.5m/15kg; equal source stats/types, individual preferences retained",
    { ids: largeIds },
    { ids: smallIds },
  );
  const physicalModel2 = pairedTreatment(
    "Same physical cohorts with model2 and no depth rules",
    { ids: largeIds, engineRules: undefined },
    { ids: smallIds, engineRules: undefined },
  );
  const physicalAddedLayer = {
    pairedMarginDifference: rounded(
      physical.pairedMeanMargin - physicalModel2.pairedMeanMargin,
    ),
    winRateDifference: rounded(
      physical.treatmentWinRate - physicalModel2.treatmentWinRate,
    ),
    offensiveReboundDifference: rounded(
      physical.meanOffensiveReboundDifference -
        physicalModel2.meanOffensiveReboundDifference,
    ),
    caveat:
      "Difference-in-differences compares the entire added engine layer, including individual preferences, chemistry, contests and signatures; it is not an isolated causal physical coefficient.",
  };
  const profileBounds = {
    minAgility: Math.min(
      ...[...POKEMON_BY_ID.values()].map(
        (p) => engineProfile(p).physical.agility,
      ),
    ),
    maxRebounding: Math.max(
      ...[...POKEMON_BY_ID.values()].map(
        (p) => engineProfile(p).physical.rebounding,
      ),
    ),
    maxFatigue: Math.max(
      ...[...POKEMON_BY_ID.values()].map(
        (p) => engineProfile(p).physical.fatigue,
      ),
    ),
  };
  const report = {
    model: "Engine rules v1 / shot model 2",
    seedStart: 424200,
    samplesPerScenario: samples,
    simulations,
    caveat:
      "Seeded design-tuning evidence, not empirical basketball calibration. Physical experiment retains individual preferences; win rates are descriptive, not causal estimates.",
    baseline: {
      points: distribution(baseline.flatMap((g) => [g.homeScore, g.awayScore])),
      possessions: distribution(baseline.map((g) => g.possessions)),
      homeWinRate: rounded(
        mean(baseline.map((g) => Number(g.homeScore > g.awayScore))),
      ),
      effectiveFieldGoal: rounded(totalFgPoints / (2 * totalFga)),
      turnoversPerTeam: rounded(
        mean(
          baseline.flatMap((g) => [
            sum(g.homeBox, "turnovers"),
            sum(g.awayBox, "turnovers"),
          ]),
        ),
      ),
      overtimeRate: rounded(
        mean(baseline.map((g) => Number(g.overtimePeriods > 0))),
      ),
      ordinaryShotExpected: rounded(expected),
      ordinaryShotActual: rounded(actual),
    },
    model2Baseline: {
      points: distribution(model2.flatMap((g) => [g.homeScore, g.awayScore])),
      possessions: distribution(model2.map((g) => g.possessions)),
      homeWinRate: rounded(
        mean(model2.map((g) => Number(g.homeScore > g.awayScore))),
      ),
    },
    addedLayerDelta: {
      meanPoints: rounded(
        mean(baseline.flatMap((g) => [g.homeScore, g.awayScore])) -
          mean(model2.flatMap((g) => [g.homeScore, g.awayScore])),
      ),
      meanPossessions: rounded(
        mean(baseline.map((g) => g.possessions)) -
          mean(model2.map((g) => g.possessions)),
      ),
    },
    catalogSample: {
      label:
        "Independent random eight-player rosters across the bundled catalog; slots are not optimized",
      speciesAvailable: catalogIds.length,
      rosterSeedStart: 714200,
      points: distribution(
        catalogGames.flatMap((g) => [g.homeScore, g.awayScore]),
      ),
      absoluteMargin: distribution(
        catalogGames.map((g) => Math.abs(g.homeScore - g.awayScore)),
      ),
    },
    styles,
    abilities,
    continuity,
    adaptive,
    physical,
    physicalModel2,
    physicalAddedLayer,
    profileBounds,
    guardrails: {
      scoreMean: [65, 150],
      possessionMean: [80, 130],
      effectiveFieldGoal: [0.35, 0.75],
      ordinaryProbabilityResidualMax: 0.03,
      abilityPairedMarginMax: 3,
      physicalWinRate: [0.2, 0.8],
    },
  };
  const failures = [];
  if (report.baseline.points.mean < 65 || report.baseline.points.mean > 150)
    failures.push("mean score outside tuning range");
  if (
    report.baseline.possessions.mean < 80 ||
    report.baseline.possessions.mean > 130
  )
    failures.push("possession mean outside tuning range");
  if (
    report.baseline.effectiveFieldGoal < 0.35 ||
    report.baseline.effectiveFieldGoal > 0.75
  )
    failures.push("eFG outside tuning range");
  if (Math.abs(actual - expected) > 0.03)
    failures.push("shot probability residual outside sampling tolerance");
  if (Math.abs(abilities.pairedMeanMargin) > 3)
    failures.push("signature swing outside small-effect tolerance");
  if (physical.treatmentWinRate < 0.2 || physical.treatmentWinRate > 0.8)
    failures.push("physical cohort dominates beyond tuning tolerance");
  if (
    styles.find((s) => s.tactic === "pace").possessions <=
    styles.find((s) => s.tactic === "defense").possessions
  )
    failures.push("pace does not increase tempo");
  if (
    styles.find((s) => s.tactic === "perimeter").threeAttempts <=
    styles.find((s) => s.tactic === "interior").threeAttempts
  )
    failures.push("perimeter does not increase threes");
  report.status = failures.length ? "CHECK" : "PASS";
  report.failures = failures;
  const output = JSON.stringify(report, null, 2) + "\n";
  const destination = process.argv
    .find((a) => a.startsWith("--out="))
    ?.slice(6);
  if (destination) await writeFile(destination, output);
  console.log(output);
  if (failures.length) process.exitCode = 1;
} finally {
  await server.close();
}
