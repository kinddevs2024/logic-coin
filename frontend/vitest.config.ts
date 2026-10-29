import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Node's smoke/linking tests are run by node --test in the package script.
// Include every Vitest TypeScript suite without executing Node suites twice.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
