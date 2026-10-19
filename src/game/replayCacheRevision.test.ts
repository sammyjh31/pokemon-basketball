// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createServer } from "vite";
import {
  gameRevision,
  replayCacheRevision,
} from "../../scripts/replay-cache-revision";

const directories: string[] = [];
afterEach(() =>
  directories
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true })),
);
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pokebb-revision-"));
  directories.push(root);
  mkdirSync(join(root, "src/game"), { recursive: true });
  mkdirSync(join(root, "src/data"), { recursive: true });
  writeFileSync(join(root, "src/game/rules.ts"), "export const strength = 1;");
  writeFileSync(join(root, "src/data/pokemon.json"), "[1,2,3]");
  return root;
}
async function revision() {
  return gameRevision;
}
it("keeps the same revision across reopenings and test-only edits", async () => {
  const root = fixture(),
    fingerprint = await revision();
  const before = fingerprint(root);
  writeFileSync(join(root, "src/game/rules.test.ts"), "a new regression");
  expect(fingerprint(root)).toBe(before);
  expect(await (await revision())(root)).toBe(before);
});
it("refreshes the real Vite revision module after a watched production edit", async () => {
  const root = fixture();
  writeFileSync(
    join(root, "entry.ts"),
    'export { default as revision } from "virtual:replay-cache-revision";',
  );
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [replayCacheRevision()],
    server: { middlewareMode: true, ws: false },
  });
  try {
    const before = (await server.ssrLoadModule("/entry.ts")).revision;
    const path = join(root, "src/game/rules.ts");
    writeFileSync(path, "export const strength = 2;");
    server.watcher.emit("change", path);
    await vi.waitFor(
      async () => {
        expect((await server.ssrLoadModule("/entry.ts")).revision).not.toBe(
          before,
        );
      },
      { timeout: 5000 },
    );
  } finally {
    await server.close();
  }
}, 10000);
it.each(["src/game/rules.ts", "src/data/pokemon.json"])(
  "invalidates verification after %s changes",
  async (file) => {
    const root = fixture(),
      fingerprint = await revision();
    const before = fingerprint(root);
    writeFileSync(join(root, file), "changed production inputs");
    expect(fingerprint(root)).not.toBe(before);
  },
);
