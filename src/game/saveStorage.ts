/**
 * Browser save storage shared by the solo/franchise and local league saves.
 *
 * Small saves stay in localStorage under their original keys, so existing
 * saves load unchanged. A save that is too large for the shared localStorage
 * quota is written to IndexedDB and its localStorage key holds a pointer.
 * Every pointer write changes the key, so other tabs still receive `storage`
 * events for both kinds of save.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface LocalArea extends StorageLike {
  removeItem(key: string): void;
}
export interface SaveRecordStore {
  readAll(): Promise<Map<string, string>>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
export interface SaveStorageEvent {
  key: string;
  error: string | null;
}

export const IDB_POINTER = "@indexeddb:";
/** Saves at or above this length move to IndexedDB, leaving localStorage room. */
export const LOCAL_STORAGE_LIMIT = 1_000_000;
export const backupKey = (key: string) => `${key}:backup`;
export const quarantineKey = (key: string) => `${key}:quarantine`;

const STORAGE_UNAVAILABLE = "Saved data in IndexedDB is unavailable.";

export class SaveStorage implements StorageLike {
  private readonly cache = new Map<string, string>();
  private readonly generation = new Map<string, number>();
  private readonly failed = new Set<string>();
  private readonly pending = new Set<Promise<void>>();
  private readonly listeners = new Set<(event: SaveStorageEvent) => void>();
  private records: SaveRecordStore | null = null;

  constructor(
    private readonly local: () => LocalArea | null,
    private readonly limit = LOCAL_STORAGE_LIMIT,
  ) {}

  /** Loads every IndexedDB save into memory so reads stay synchronous. */
  async attach(records: SaveRecordStore, timeout = 3000): Promise<void> {
    try {
      const all = await Promise.race([
        records.readAll(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), timeout),
        ),
      ]);
      const local = this.local();
      for (const [key, value] of all) {
        // A record without a pointer is left over from an interrupted write
        // that localStorage never adopted; the localStorage value is newer.
        let raw: string | null = null;
        try {
          raw = local ? local.getItem(key) : IDB_POINTER;
        } catch {
          raw = IDB_POINTER;
        }
        if (raw?.startsWith(IDB_POINTER)) this.cache.set(key, value);
      }
      this.records = records;
    } catch {
      // Pointer keys then report storage as unavailable instead of loading
      // as empty, and are never replaced by a fresh save.
    }
  }

  getItem(key: string): string | null {
    // The cache holds only IndexedDB saves, including writes still committing.
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const local = this.local();
    if (!local) return null;
    const raw = local.getItem(key);
    if (raw?.startsWith(IDB_POINTER)) throw new Error(STORAGE_UNAVAILABLE);
    return raw;
  }

  setItem(key: string, value: string): void {
    const generation = (this.generation.get(key) ?? 0) + 1;
    this.generation.set(key, generation);
    const local = this.local();
    const current = local?.getItem(key) ?? null;
    const pointer = !!current?.startsWith(IDB_POINTER);
    if (pointer && !this.records) throw new Error(STORAGE_UNAVAILABLE);
    if (local && (!this.records || value.length < this.limit)) {
      try {
        local.setItem(key, value);
        if (this.cache.delete(key))
          void this.records?.delete(key).catch(() => {});
        this.failed.delete(key);
        return;
      } catch (error) {
        // A full localStorage quota overflows into IndexedDB when available.
        if (!this.records) throw error;
      }
    }
    const records = this.records;
    if (!records) throw new Error(STORAGE_UNAVAILABLE);
    if (
      (pointer || !local) &&
      this.cache.get(key) === value &&
      !this.failed.has(key)
    )
      return;
    this.cache.set(key, value);
    const write = records
      .put(key, value)
      .then(() => {
        if (this.generation.get(key) !== generation) return;
        local?.setItem(
          key,
          `${IDB_POINTER}${generation.toString(36)}-${Date.now().toString(36)}`,
        );
        this.failed.delete(key);
        this.emit({ key, error: null });
      })
      .catch(() => {
        if (this.generation.get(key) !== generation) return;
        this.failed.add(key);
        this.emit({
          key,
          error:
            "Could not save to browser storage. You can keep playing, but refreshing or leaving may lose progress.",
        });
      })
      .finally(() => this.pending.delete(write));
    this.pending.add(write);
  }

  removeItem(key: string): void {
    this.generation.set(key, (this.generation.get(key) ?? 0) + 1);
    this.local()?.removeItem(key);
    if (this.cache.delete(key)) void this.records?.delete(key).catch(() => {});
  }

  /** True while an IndexedDB write has not committed yet. */
  get busy(): boolean {
    return this.pending.size > 0;
  }

  /** Resolves once every queued IndexedDB write has committed or failed. */
  async flush(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  subscribe(listener: (event: SaveStorageEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SaveStorageEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

/** Backup and quarantine slots need a store that keeps keys apart. */
export const isSaveStorage = (storage: StorageLike): storage is SaveStorage =>
  storage instanceof SaveStorage;

/** Keeps a copy of a save that has just passed full validation. */
export function keepVerifiedCopy(
  storage: StorageLike,
  key: string,
  source: string,
): boolean {
  if (!isSaveStorage(storage)) return false;
  try {
    if (storage.getItem(backupKey(key)) !== source)
      storage.setItem(backupKey(key), source);
    return true;
  } catch {
    return false;
  }
}

/** Moves a rejected save aside so later saves cannot overwrite it. */
export function setAsideRejected(
  storage: StorageLike,
  key: string,
  source: string,
): boolean {
  if (!isSaveStorage(storage)) return false;
  try {
    if (storage.getItem(quarantineKey(key)) !== source)
      storage.setItem(quarantineKey(key), source);
    return true;
  } catch {
    return false;
  }
}

export function readSlot(storage: StorageLike, key: string): string | null {
  if (!isSaveStorage(storage)) return null;
  try {
    return storage.getItem(key) || null;
  } catch {
    return null;
  }
}

export function indexedDbRecords(
  factory: IDBFactory,
  name = "pokemon-basketball-saves",
): SaveRecordStore {
  let database: Promise<IDBDatabase> | undefined;
  const open = () =>
    (database ??= new Promise((resolve, reject) => {
      const request = factory.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("saves");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Save database is blocked."));
    }));
  const run = <T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T> | void,
  ) =>
    open().then(
      (db) =>
        new Promise<T | undefined>((resolve, reject) => {
          const transaction = db.transaction("saves", mode, {
            durability: "strict",
          });
          const request = action(transaction.objectStore("saves"));
          transaction.oncomplete = () => resolve(request?.result);
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () =>
            reject(transaction.error ?? new Error("Save transaction aborted."));
        }),
    );
  return {
    async readAll() {
      const all = new Map<string, string>();
      await run("readonly", (store) => {
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (!row) return;
          if (typeof row.value === "string")
            all.set(String(row.key), row.value);
          row.continue();
        };
      });
      return all;
    },
    put: (key, value) =>
      run("readwrite", (store) => store.put(value, key)).then(() => {}),
    delete: (key) =>
      run("readwrite", (store) => store.delete(key)).then(() => {}),
  };
}

// Accessing a blocked localStorage throws, which callers report as before.
const localArea = (): LocalArea => ({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
});

/** The one browser save store used by every game mode. */
export const browserStorage = new SaveStorage(localArea);

/** Opens IndexedDB before the first render; falls back to localStorage only. */
export async function openBrowserSaves(timeout = 3000): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await browserStorage.attach(indexedDbRecords(indexedDB), timeout);
  window.addEventListener("beforeunload", (event) => {
    if (browserStorage.busy) event.preventDefault();
  });
}
