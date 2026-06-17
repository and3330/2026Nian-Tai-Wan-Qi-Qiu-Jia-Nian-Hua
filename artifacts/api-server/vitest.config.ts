import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Integration tests share a single Postgres database, so run files
    // serially to keep capacity counts deterministic across suites.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
