import { defineConfig } from "vitest/config";

// Node's smoke/linking tests are run by node --test in the package script.
// Include every Vitest TypeScript suite without executing Node suites twice.
export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
