import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  define: {
    __WITH_MOCK__: true,
    __APP_VERSION__: JSON.stringify("0.0.0-test"),
    __BUILD_COMMIT__: JSON.stringify("abc1234"),
    __BUILD_DATE__: JSON.stringify("2026-10-26"),
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["src/testing/setup.ts"],
    maxWorkers: 4,
    // The app tests click through whole flows against the mock's real delays; 5 s fails them on a busy machine.
    testTimeout: 15_000,
    // The cached transform of a test keeps its old import.meta.glob result: a new messages file went unchecked by
    // catalogs.test.ts until the cache was deleted (RISK-100).
    fsModuleCache: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.*", "src/testing/**", "src/main.tsx", "src/start.tsx", "src/platform/mock.ts"],
      reporter: ["text-summary", "html"],
    },
  },
})
