import { webcrypto } from "node:crypto";
import { expect, it, vi } from "vitest";
import { browserReplayCache } from "./browserReplayCache";

it.each(["indexedDB", "crypto"])(
  "falls back when access to the browser's %s API itself is blocked",
  (name) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    vi.stubGlobal("crypto", webcrypto);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    try {
      expect(() => browserReplayCache()).not.toThrow();
      expect(browserReplayCache()).toBeUndefined();
    } finally {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
      vi.unstubAllGlobals();
    }
  },
);
