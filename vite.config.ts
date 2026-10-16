import { realpathSync } from "node:fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [process.cwd(), realpathSync("node_modules")] } },
  test: {
    // League replay tests each simulate thousands of games. Bound CPU-heavy
    // workers so parallel suites do not starve UI timers on local/cloud hosts.
    maxWorkers: 1,
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
