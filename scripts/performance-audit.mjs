/** Run one phase at a time without other CPU-heavy tests; see docs/PERFORMANCE.md. */
import { createHash } from "node:crypto";
import { Session } from "node:inspector";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createServer } from "vite";

const options = new Map();
for (const arg of process.argv.slice(2)) {
  if (arg === "--help") {
    console.log(
      "node scripts/performance-audit.mjs --phase=season|save|cached-save|local-save [--rules=legacy|current] [--save=export.json] [--output=metrics.json] [--baseline=metrics.json] [--profile=cpu.cpuprofile]",
    );
    process.exit(0);
  }
  const match = /^--(phase|rules|save|output|baseline|profile)=(.+)$/.exec(arg);
  if (!match) throw Error(`Unknown option: ${arg}`);
  options.set(match[1], match[2]);
}
const phase = options.get("phase") ?? "season";
if (!["season", "save", "cached-save", "local-save"].includes(phase))
  throw Error("Phase must be season, save, cached-save or local-save.");
if (["save", "cached-save"].includes(phase) && !options.has("save"))
  throw Error("Save phase needs --save=path-to-export.json.");
const rules = options.get("rules") ?? "legacy";
if (!["legacy", "current"].includes(rules))
  throw Error("Rules must be legacy or current.");
if (rules === "current" && phase !== "season")
  throw Error("Current rules applies only to a season audit.");
const hash = (text) => createHash("sha256").update(text).digest("hex");
const source = ["save", "cached-save"].includes(phase)
  ? await readFile(options.get("save"), "utf8")
  : undefined;
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: "custom",
  logLevel: "error",
});
let session;
const post = (method) =>
  new Promise((resolve, reject) =>
    session.post(method, (error, value) =>
      error ? reject(error) : resolve(value),
    ),
  );
try {
  const { performanceRun, currentPerformanceRun } = await server.ssrLoadModule(
    "/src/game/seasonPerformance.testUtils.ts",
  );
  const { simulateSeason } = await server.ssrLoadModule("/src/game/season.ts");
  const { createLeague } = await server.ssrLoadModule("/src/game/league.ts");
  const { simulateMatch } = await server.ssrLoadModule("/src/game/match.ts");
  const { prepareGameLoad, STORAGE_KEY } = await server.ssrLoadModule(
    "/src/game/persistence.ts",
  );
  const run = rules === "current" ? currentPerformanceRun() : performanceRun(),
    teams = createLeague(run);
  for (let i = 0; i < 8; i++) simulateMatch(teams[i], teams[i + 1], i);
  if (options.has("profile") && ["cached-save", "local-save"].includes(phase))
    throw Error("Use separate uncached phases for CPU profiles.");
  if (options.has("profile")) {
    session = new Session();
    session.connect();
    await post("Profiler.enable");
    await post("Profiler.start");
  }
  let result, reportedGames, cacheComparison;
  if (["cached-save", "local-save"].includes(phase)) {
    const { ReplayCache } = await server.ssrLoadModule(
      "/src/game/replayCache.ts",
    );
    const { memoryReplayRecords } = await server.ssrLoadModule(
      "/src/game/replayCache.testUtils.ts",
    );
    const { default: revision } = await server.ssrLoadModule(
      "virtual:replay-cache-revision",
    );
    const records = memoryReplayRecords();
    const connect = () =>
      new ReplayCache(records.connect(), globalThis.crypto, revision);
    let unchangedSource = source;
    if (phase === "local-save") {
      const { localCareerFixture } = await server.ssrLoadModule(
        "/src/game/localReplayCache.testUtils.ts",
      );
      unchangedSource = JSON.stringify(localCareerFixture(10));
    }
    const localRestore =
      phase === "local-save"
        ? (await server.ssrLoadModule("/src/game/localCareerCache.ts"))
            .restoreLocalCareerSource
        : undefined;
    const open = async () => {
      let work;
      const began = performance.now();
      let loaded;
      if (phase === "local-save") {
        const restored = await localRestore(
          unchangedSource,
          () => {},
          new AbortController().signal,
          connect(),
        );
        loaded = restored.draft;
        work = {
          replayedYears: restored.replayedYears,
          cachedYears: restored.cachedYears,
        };
      } else {
        const prepared = prepareGameLoad(
          {
            getItem: (key) => (key === STORAGE_KEY ? unchangedSource : null),
            setItem: () => {
              throw Error("Read-only audit");
            },
          },
          822,
        );
        loaded = prepared.restore
          ? await prepared.restore(
              (_done, total) => {
                work = { reportedGames: total };
              },
              new AbortController().signal,
              connect(),
            )
          : prepared;
        if (loaded.notice) throw Error(loaded.notice);
      }
      const elapsed = performance.now() - began;
      const serialized = JSON.stringify(loaded);
      return {
        ms: elapsed,
        hash: hash(serialized),
        serializedCharacters: serialized.length,
        ...work,
      };
    };
    const cold = await open();
    const warm = await open();
    if (
      cold.hash !== warm.hash ||
      cold.serializedCharacters !== warm.serializedCharacters
    )
      throw Error("Warm restore changed results/history.");
    if (phase === "cached-save" && warm.reportedGames !== 0)
      throw Error("Warm restore replayed games.");
    if (phase === "local-save" && warm.replayedYears.length)
      throw Error("Warm restore replayed years.");
    const report = {
      phase,
      cold,
      warm,
      sourceHash: hash(unchangedSource),
      engineRevision: revision,
      speedup: cold.ms / warm.ms,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      scope:
        "Vite SSR, real WebCrypto, durable memory record adapter; browser startup and IndexedDB I/O excluded",
    };
    if (options.has("baseline")) {
      const baseline = JSON.parse(
        await readFile(options.get("baseline"), "utf8"),
      );
      if (
        baseline.sourceHash !== report.sourceHash ||
        (baseline.warm?.hash ?? baseline.hash) !== warm.hash
      )
        throw Error("Input or full output differs from baseline.");
      report.baselineHashMatches = true;
    }
    if (options.has("output")) {
      await mkdir(dirname(options.get("output")), { recursive: true });
      await writeFile(
        options.get("output"),
        JSON.stringify(report, null, 2) + "\n",
      );
    }
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 0;
    // The finally block closes the Vite server before returning.
    cacheComparison = report;
  }
  if (!cacheComparison) {
    const start = performance.now();
    if (phase === "season") result = simulateSeason(run);
    else {
      const prepared = prepareGameLoad(
        {
          getItem: (key) => (key === STORAGE_KEY ? source : null),
          setItem: () => {},
        },
        822,
      );
      result = prepared.restore
        ? await prepared.restore((_done, total) => {
            reportedGames = total;
          }, new AbortController().signal)
        : prepared;
      if (result.notice) throw Error(result.notice);
    }
    const ms = performance.now() - start;
    if (session) {
      const { profile } = await post("Profiler.stop");
      await mkdir(dirname(options.get("profile")), { recursive: true });
      await writeFile(options.get("profile"), JSON.stringify(profile));
    }
    const serialized = JSON.stringify(result);
    const report = {
      phase,
      rules,
      ms,
      hash: hash(serialized),
      serializedCharacters: serialized.length,
      ...(source ? { sourceHash: hash(source), reportedGames } : {}),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      profiled: options.has("profile"),
    };
    if (options.has("baseline")) {
      const baseline = JSON.parse(
        await readFile(options.get("baseline"), "utf8"),
      );
      if (
        baseline.phase !== phase ||
        (baseline.rules ?? "legacy") !== rules ||
        baseline.sourceHash !== report.sourceHash
      )
        throw Error(
          "Baseline must use the same phase and unchanged save input.",
        );
      if (baseline.hash !== report.hash)
        throw Error("Output differs from the recorded baseline.");
      report.speedup = baseline.ms / ms;
    }
    if (options.has("output")) {
      await mkdir(dirname(options.get("output")), { recursive: true });
      await writeFile(
        options.get("output"),
        JSON.stringify(report, null, 2) + "\n",
      );
    }
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  session?.disconnect();
  await server.close();
}
