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
      "node scripts/performance-audit.mjs --phase=season|save [--save=export.json] [--output=metrics.json] [--baseline=metrics.json] [--profile=cpu.cpuprofile]",
    );
    process.exit(0);
  }
  const match = /^--(phase|save|output|baseline|profile)=(.+)$/.exec(arg);
  if (!match) throw Error(`Unknown option: ${arg}`);
  options.set(match[1], match[2]);
}
const phase = options.get("phase") ?? "season";
if (!["season", "save"].includes(phase))
  throw Error("Phase must be season or save.");
if (phase === "save" && !options.has("save"))
  throw Error("Save phase needs --save=path-to-export.json.");
const hash = (text) => createHash("sha256").update(text).digest("hex");
const source =
  phase === "save" ? await readFile(options.get("save"), "utf8") : undefined;
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
  const { performanceRun } = await server.ssrLoadModule(
    "/src/game/seasonPerformance.testUtils.ts",
  );
  const { simulateSeason } = await server.ssrLoadModule("/src/game/season.ts");
  const { createLeague } = await server.ssrLoadModule("/src/game/league.ts");
  const { simulateMatch } = await server.ssrLoadModule("/src/game/match.ts");
  const { prepareGameLoad, STORAGE_KEY } = await server.ssrLoadModule(
    "/src/game/persistence.ts",
  );
  const run = performanceRun(),
    teams = createLeague(run);
  for (let i = 0; i < 8; i++) simulateMatch(teams[i], teams[i + 1], i);
  if (options.has("profile")) {
    session = new Session();
    session.connect();
    await post("Profiler.enable");
    await post("Profiler.start");
  }
  let result, reportedGames;
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
    if (baseline.phase !== phase || baseline.sourceHash !== report.sourceHash)
      throw Error("Baseline must use the same phase and unchanged save input.");
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
} finally {
  session?.disconnect();
  await server.close();
}
