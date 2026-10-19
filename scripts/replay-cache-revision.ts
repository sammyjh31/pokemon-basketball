import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { Plugin } from "vite";

const PUBLIC_ID = "virtual:replay-cache-revision";
const INTERNAL_ID = `\0${PUBLIC_ID}`;
function sources(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (
        /\.(ts|json)$/.test(path) &&
        !/\.(test|testUtils)\.ts$/.test(path)
      )
        files.push(path);
    }
  };
  visit(join(root, "src/game"));
  visit(join(root, "src/data"));
  for (const file of [
    "package-lock.json",
    "vite.config.ts",
    "scripts/replay-cache-revision.ts",
  ])
    if (existsSync(join(root, file))) files.push(join(root, file));
  return files.sort();
}
/** Content-based: restarts/test edits retain proofs; production changes do not. */
export function gameRevision(root: string): string {
  const hash = createHash("sha256").update("verified-replay-v1\0");
  for (const file of sources(root)) {
    const content = readFileSync(file);
    hash.update(relative(root, file).replaceAll("\\", "/"));
    hash.update(`\0${content.length}\0`);
    hash.update(content);
  }
  return hash.digest("hex");
}
export function replayCacheRevision(): Plugin {
  let root = process.cwd();
  const relevant = (file: string) => {
    const path = relative(root, file).replaceAll("\\", "/");
    return (
      /^(src\/(game|data)\/.*\.(ts|json)|package-lock\.json|vite\.config\.ts|scripts\/replay-cache-revision\.ts)$/.test(
        path,
      ) && !/\.(test|testUtils)\.ts$/.test(path)
    );
  };
  return {
    name: "verified-replay-revision",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id === PUBLIC_ID) return INTERNAL_ID;
    },
    load(id) {
      if (id !== INTERNAL_ID) return;
      for (const file of sources(root)) this.addWatchFile(file);
      return `export default ${JSON.stringify(gameRevision(root))};`;
    },
    hotUpdate(context) {
      if (!relevant(context.file)) return;
      const module = this.environment.moduleGraph.getModuleById(INTERNAL_ID);
      if (!module) return;
      this.environment.moduleGraph.invalidateModule(module);
      return [...new Set([...context.modules, module])];
    },
  };
}
