import {
  REPLAY_CACHE_LIMIT,
  REPLAY_CACHE_SCOPES,
  type ReplayCacheStore,
  type ReplayCacheRecord,
} from "./replayCache";

export const REPLAY_CACHE_DATABASE = "pokemon-basketball-replay-cache";
const KEY = "signing-key";
const validKey = (value: CryptoKey | undefined): value is CryptoKey =>
  !!value &&
  value.type === "secret" &&
  value.extractable === false &&
  value.algorithm?.name === "HMAC" &&
  (value.algorithm as HmacKeyAlgorithm).hash?.name === "SHA-256" &&
  value.usages.includes("sign") &&
  value.usages.includes("verify");

/** Separate database: cache eviction cannot touch save/backup/quarantine slots. */
export function indexedReplayRecords(
  factory: IDBFactory,
  name = REPLAY_CACHE_DATABASE,
): ReplayCacheStore {
  let opened: Promise<IDBDatabase> | undefined;
  const open = () =>
    (opened ??= new Promise((resolve, reject) => {
      let settled = false;
      const request = factory.open(name, 1);
      const timer = setTimeout(() => {
        settled = true;
        reject(Error("Replay cache unavailable."));
      }, 1000);
      const fail = (error: Error | DOMException) => {
        settled = true;
        clearTimeout(timer);
        reject(error);
      };
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("records");
        store.createIndex("scope", "scope");
        store.createIndex("scopeAge", ["scope", "updated"]);
        store.createIndex("bytes", "bytes");
        store.createIndex("ageBytes", ["updated", "bytes"]);
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (settled) request.result.close();
        else {
          settled = true;
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        }
      };
      request.onerror = () =>
        fail(request.error ?? Error("Replay cache unavailable."));
      request.onblocked = () => fail(Error("Replay cache blocked."));
    }));
  const run = async <T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore, done: (value: T) => void) => void,
  ): Promise<T> => {
    const database = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction("records", mode, {
        durability: "relaxed",
      });
      let result: T;
      const timer = setTimeout(() => {
        try {
          transaction.abort();
        } catch {
          /* Already inactive. */
        }
        reject(Error("Replay cache timed out."));
      }, 1500);
      transaction.oncomplete = () => {
        clearTimeout(timer);
        resolve(result);
      };
      const fail = () => {
        clearTimeout(timer);
        reject(transaction.error ?? Error("Replay cache interrupted."));
      };
      transaction.onerror = fail;
      transaction.onabort = fail;
      try {
        action(transaction.objectStore("records"), (value) => {
          result = value;
        });
      } catch (error) {
        clearTimeout(timer);
        transaction.abort();
        reject(error);
      }
    });
  };
  const read = <T>(id: string) =>
    run<T | undefined>("readonly", (store, done) => {
      const request = store.get(id);
      request.onsuccess = () => done(request.result);
    });
  return {
    async key(create) {
      const existing = await read<CryptoKey>(KEY);
      if (validKey(existing)) return existing;
      const generated = await create();
      return run<CryptoKey>("readwrite", (store, done) => {
        // Transactions serialize this check: concurrent workers adopt one key.
        const request = store.get(KEY);
        request.onsuccess = () => {
          const chosen = validKey(request.result) ? request.result : generated;
          if (chosen === generated) store.put(generated, KEY);
          done(chosen);
        };
      });
    },
    read: (id) => read<ReplayCacheRecord>(id),
    write: (id, record) =>
      run<void>("readwrite", (store) => {
        store.put(record, id);
        const trimBudget = () => {
          let bytes = 0;
          const sizes = store.index("bytes").openKeyCursor();
          sizes.onsuccess = () => {
            const cursor = sizes.result;
            if (cursor) {
              bytes += Number(cursor.key);
              cursor.continue();
              return;
            }
            if (bytes <= REPLAY_CACHE_LIMIT) return;
            const oldest = store.index("ageBytes").openKeyCursor();
            oldest.onsuccess = () => {
              const cursor = oldest.result;
              if (!cursor || bytes <= REPLAY_CACHE_LIMIT) return;
              bytes -= Number((cursor.key as IDBValidKey[])[1]);
              store.delete(cursor.primaryKey);
              cursor.continue();
            };
          };
        };
        const count = store.index("scope").count(record.scope);
        count.onsuccess = () => {
          let excess = count.result - REPLAY_CACHE_SCOPES[record.scope];
          if (excess <= 0) {
            trimBudget();
            return;
          }
          const oldest = store
            .index("scopeAge")
            .openKeyCursor(
              IDBKeyRange.bound(
                [record.scope, 0],
                [record.scope, Number.MAX_SAFE_INTEGER],
              ),
            );
          oldest.onsuccess = () => {
            const cursor = oldest.result;
            if (!cursor || excess <= 0) {
              trimBudget();
              return;
            }
            store.delete(cursor.primaryKey);
            excess--;
            cursor.continue();
          };
        };
      }),
  };
}
