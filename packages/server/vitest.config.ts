import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 60_000,
    // Both suites reseed the same single-file Relate store; run files serially to avoid races.
    fileParallelism: false,
  },
});