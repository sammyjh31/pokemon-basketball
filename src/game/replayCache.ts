/** Disposable replay evidence; never an authoritative save or backup. */
export const REPLAY_CACHE_LIMIT = 32 * 1024 * 1024;
export const REPLAY_CACHE_RECORD_LIMIT = 8 * 1024 * 1024;
export const REPLAY_CACHE_SCOPES = {
  "solo-archive": 2048,
  "solo-active": 2,
  "local-archive": 128,
  "local-season": 2,
} as const;
export type ReplayCacheScope = keyof typeof REPLAY_CACHE_SCOPES;
export interface ReplayCacheRecord {
  schema: 1;
  scope: ReplayCacheScope;
  payload: string;
  signature: string;
  updated: number;
  bytes: number;
}
export interface ReplayCacheStore {
  key(create: () => Promise<CryptoKey>): Promise<CryptoKey>;
  read(id: string): Promise<ReplayCacheRecord | undefined>;
  write(id: string, record: ReplayCacheRecord): Promise<void>;
}
const hex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const unhex = (value: string) =>
  Uint8Array.from(value.match(/../g)!, (byte) => parseInt(byte, 16));

/** A hit authenticates exact inputs and derived evidence before parsing it. */
export class ReplayCache {
  private readonly encoder = new TextEncoder();
  private signingKey?: Promise<CryptoKey>;
  constructor(
    private readonly store: ReplayCacheStore,
    private readonly crypto: Crypto,
    private readonly revision: string,
  ) {}

  private key() {
    return (this.signingKey ??= this.store.key(() =>
      this.crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, [
        "sign",
        "verify",
      ]),
    ));
  }
  private async id(scope: ReplayCacheScope, input: string) {
    const digest = await this.crypto.subtle.digest(
      "SHA-256",
      this.encoder.encode(input),
    );
    return `${this.revision}:${scope}:${hex(digest)}`;
  }
  async get<T>(scope: ReplayCacheScope, input: string): Promise<T | undefined> {
    try {
      const id = await this.id(scope, input);
      const record = await this.store.read(id);
      if (
        !record ||
        record.schema !== 1 ||
        record.scope !== scope ||
        typeof record.payload !== "string" ||
        record.payload.length > REPLAY_CACHE_RECORD_LIMIT ||
        !/^[a-f0-9]{64}$/.test(record.signature)
      )
        return undefined;
      const valid = await this.crypto.subtle.verify(
        "HMAC",
        await this.key(),
        unhex(record.signature),
        this.encoder.encode(`${id}\n${record.payload}`),
      );
      return valid ? (JSON.parse(record.payload) as T) : undefined;
    } catch {
      return undefined;
    }
  }
  async put(
    scope: ReplayCacheScope,
    input: string,
    value: unknown,
  ): Promise<void> {
    try {
      const payload = JSON.stringify(value);
      if (payload === undefined || payload.length > REPLAY_CACHE_RECORD_LIMIT)
        return;
      const payloadBytes = this.encoder.encode(payload).byteLength;
      if (payloadBytes > REPLAY_CACHE_RECORD_LIMIT) return;
      const id = await this.id(scope, input);
      const signature = hex(
        await this.crypto.subtle.sign(
          "HMAC",
          await this.key(),
          this.encoder.encode(`${id}\n${payload}`),
        ),
      );
      await this.store.write(id, {
        schema: 1,
        scope,
        payload,
        signature,
        updated: Date.now(),
        bytes: payloadBytes + id.length * 2 + 256,
      });
    } catch {
      // Quota, unavailable crypto/storage and interrupted writes only lose speed.
    }
  }
}
