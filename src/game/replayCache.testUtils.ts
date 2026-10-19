import type { ReplayCacheStore, ReplayCacheRecord } from "./replayCache";

/** Separate connections share durable records/key, as browser workers do. */
export function memoryReplayRecords() {
  const records = new Map<string, ReplayCacheRecord>();
  let key: Promise<CryptoKey> | undefined;
  let failure = false;
  let returned: ReplayCacheRecord | undefined;
  const connect = (): ReplayCacheStore => ({
    async key(create) {
      if (failure) throw Error("storage unavailable");
      return (key ??= create());
    },
    async read(id) {
      if (failure) throw Error("storage unavailable");
      return structuredClone(returned ?? records.get(id));
    },
    async write(id, value) {
      if (failure) throw Error("quota");
      records.set(id, structuredClone(value));
    },
  });
  return {
    connect,
    records,
    fail: (value: boolean) => (failure = value),
    substitute: (record: ReplayCacheRecord) => (returned = record),
    key: () => key,
  };
}
