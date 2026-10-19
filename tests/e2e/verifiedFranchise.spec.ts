import { expect, test, type Page } from "@playwright/test";
import { asReturningPlayer } from "./returningPlayer";

test.beforeEach(({ page }) => asReturningPlayer(page));
const KEY = "pokemon-basketball:v3";

/** Real worker messages and browser IndexedDB; no simulation/cache mocks. */
async function restored(page: Page, source: string) {
  return page.evaluate(async (source) => {
    const worker = new Worker("/src/game/restore.worker.ts", {
      type: "module",
    });
    const progress: number[][] = [];
    try {
      const loaded = await new Promise<any>((resolve, reject) => {
        worker.onerror = (event) => reject(Error(event.message));
        worker.onmessage = ({ data }) => {
          if (data.progress) progress.push(data.progress);
          else if (data.loaded) resolve(data.loaded);
          else reject(Error(data.error));
        };
        worker.postMessage({ kind: "game", source, seed: 822 });
      });
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(loaded)),
      );
      return {
        hash: Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
        progress: progress.at(-1),
        notice: loaded.notice,
        years: loaded.state.franchise.history.length,
        sourceUnchanged:
          JSON.stringify(JSON.parse(source).franchise.history) ===
          JSON.stringify(loaded.state.franchise.history),
      };
    } finally {
      worker.terminate();
    }
  }, source);
}

test("reopens a real franchise after refresh and recovers from a damaged disposable snapshot", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const source = await page.evaluate(async () => {
    const path = "/src/game/verifiedFranchise.testUtils.ts";
    const { verifiedFranchiseFixture } = await import(path);
    return JSON.stringify(verifiedFranchiseFixture());
  });
  const cold = await restored(page, source);
  expect(cold.notice).toBeNull();
  expect(cold.progress![1]).toBeGreaterThanOrEqual(1230);
  expect(cold.years).toBe(1);
  // Seed through the application's authoritative storage, including IDB pointers.
  await page.evaluate(
    async ({ key, source }) => {
      const path = "/src/game/saveStorage.ts";
      const { browserStorage } = await import(path);
      browserStorage.setItem(key, source);
      await browserStorage.flush();
    },
    { key: KEY, source },
  );
  await page.goto("/#season");
  await page.reload();
  await expect(page.getByTestId("season-record")).toBeVisible({
    timeout: 20000,
  });
  const warm = await restored(page, source);
  expect(warm.hash).toBe(cold.hash);
  expect(warm.progress).toEqual([0, 0]);
  // Corrupt only active cached payloads; historical certificates stay intact.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("pokemon-basketball-replay-cache", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("records", "readwrite");
          const cursor = tx.objectStore("records").openCursor();
          cursor.onsuccess = () => {
            const row = cursor.result;
            if (!row) return;
            if (row.value.scope === "solo-active")
              row.update({ ...row.value, payload: "{}" });
            row.continue();
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  const repaired = await restored(page, source);
  expect(repaired.notice).toBeNull();
  expect(repaired.hash).toBe(cold.hash);
  expect(repaired.progress![1]).toBe(1230);
  expect((await restored(page, source)).progress).toEqual([0, 0]);
  const retained = await page.evaluate(async (key) => {
    const path = "/src/game/saveStorage.ts";
    const { browserStorage } = await import(path);
    return {
      source: browserStorage.getItem(key),
      quarantine: browserStorage.getItem(`${key}:quarantine`),
    };
  }, KEY);
  // The app may normalize the main slot; the exact original remains its backup.
  expect(JSON.parse(retained.source!).franchise.history).toEqual(
    JSON.parse(source).franchise.history,
  );
  expect(retained.quarantine).toBeNull();
  expect(errors).toEqual([]);
});
