import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/*/test/**/*.test.ts"],
    exclude: ["packages/bun/test/**/*.test.ts", "node_modules", "dist"]
  }
});