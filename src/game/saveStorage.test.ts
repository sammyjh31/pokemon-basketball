import { describe, expect, it } from "vitest";
import {
  backupKey,
  IDB_POINTER,
  keepVerifiedCopy,
  quarantineKey,
  readSlot,
  SaveStorage,
  setAsideRejected,
  type LocalArea,
  type SaveRecordStore,
} from "./saveStorage";

function memoryArea(quota = Infinity) {
  const data = new Map<string, string>();
  const area: LocalArea = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      const used = [...data].reduce(
        (sum, [k, v]) => sum + (k === key ? 0 : k.length + v.length),
        0,
      );
      if (used + key.length + value.length > quota)
        throw new DOMException("full", "QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key) => void data.delete(key),
  };
  return { data, area };
}
function memoryRecords() {
  const data = new Map<string, string>();
  let failing = false;
  const records: SaveRecordStore = {
    readAll: async () => new Map(data),
    put: async (key, value) => {
      await Promise.resolve();
      if (failing) throw new Error("quota");
      data.set(key, value);
    },
    delete: async (key) => void data.delete(key),
  };
  return { data, records, fail: (value: boolean) => (failing = value) };
}

describe("browser save storage", () => {
  it("keeps small saves in localStorage under their original keys", async () => {
    const local = memoryArea(),
      idb = memoryRecords(),
      storage = new SaveStorage(() => local.area, 10);
    await storage.attach(idb.records);
    storage.setItem("save", "small");
    expect(local.data.get("save")).toBe("small");
    expect(storage.getItem("save")).toBe("small");
    expect(idb.data.size).toBe(0);
  });

  it("moves large saves to IndexedDB behind a changing pointer and reloads them", async () => {
    const local = memoryArea(),
      idb = memoryRecords(),
      storage = new SaveStorage(() => local.area, 10);
    await storage.attach(idb.records);
    const large = "x".repeat(50);
    storage.setItem("save", large);
    expect(storage.getItem("save")).toBe(large);
    expect(storage.busy).toBe(true);
    await storage.flush();
    expect(storage.busy).toBe(false);
    expect(idb.data.get("save")).toBe(large);
    const pointer = local.data.get("save")!;
    expect(pointer.startsWith(IDB_POINTER)).toBe(true);
    // An identical rewrite is skipped, so other tabs see no change.
    storage.setItem("save", large);
    await storage.flush();
    expect(local.data.get("save")).toBe(pointer);
    storage.setItem("save", `${large}y`);
    await storage.flush();
    expect(local.data.get("save")).not.toBe(pointer);

    const reopened = new SaveStorage(() => local.area, 10);
    await reopened.attach(idb.records);
    expect(reopened.getItem("save")).toBe(`${large}y`);
    // Shrinking back below the limit returns the save to localStorage.
    reopened.setItem("save", "tiny");
    await reopened.flush();
    expect(local.data.get("save")).toBe("tiny");
    expect(idb.data.has("save")).toBe(false);
  });

  it("overflows into IndexedDB when localStorage is full", async () => {
    const local = memoryArea(30),
      idb = memoryRecords(),
      storage = new SaveStorage(() => local.area, 1000);
    await storage.attach(idb.records);
    storage.setItem("a", "1".repeat(20));
    storage.setItem("b", "2".repeat(20));
    await storage.flush();
    expect(local.data.get("a")).toBe("1".repeat(20));
    expect(idb.data.get("b")).toBe("2".repeat(20));
    expect(storage.getItem("b")).toBe("2".repeat(20));
  });

  it("never replaces an IndexedDB save it cannot read", () => {
    const local = memoryArea();
    local.data.set("save", `${IDB_POINTER}1`);
    const storage = new SaveStorage(() => local.area, 10);
    expect(() => storage.getItem("save")).toThrow(/unavailable/);
    expect(() => storage.setItem("save", "fresh")).toThrow(/unavailable/);
    expect(local.data.get("save")).toBe(`${IDB_POINTER}1`);
  });

  it("reports failed IndexedDB writes and retries the same save", async () => {
    const local = memoryArea(),
      idb = memoryRecords(),
      storage = new SaveStorage(() => local.area, 10),
      events: (string | null)[] = [];
    await storage.attach(idb.records);
    storage.subscribe(({ error }) => events.push(error));
    idb.fail(true);
    storage.setItem("save", "x".repeat(20));
    await storage.flush();
    expect(events).toEqual([expect.stringMatching(/Could not save/)]);
    expect(local.data.has("save")).toBe(false);
    idb.fail(false);
    storage.setItem("save", "x".repeat(20));
    await storage.flush();
    expect(events.at(-1)).toBeNull();
    expect(idb.data.get("save")).toBe("x".repeat(20));
  });

  it("keeps backup and quarantine copies only in a store that separates keys", async () => {
    const local = memoryArea(),
      storage = new SaveStorage(() => local.area);
    expect(keepVerifiedCopy(storage, "save", "good")).toBe(true);
    expect(setAsideRejected(storage, "save", "bad")).toBe(true);
    expect(readSlot(storage, backupKey("save"))).toBe("good");
    expect(readSlot(storage, quarantineKey("save"))).toBe("bad");
    let writes = 0;
    const single = {
      getItem: () => "value",
      setItem: () => void writes++,
    };
    expect(keepVerifiedCopy(single, "save", "good")).toBe(false);
    expect(setAsideRejected(single, "save", "bad")).toBe(false);
    expect(writes).toBe(0);
  });
});
