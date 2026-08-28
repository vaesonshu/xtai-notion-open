import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@excalidraw/excalidraw": path.resolve(
        __dirname,
        "../../packages/editor-core/test/mocks/excalidraw.ts"
      ),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.integration.setup.ts"],
    include: ["test/**/*.integration.spec.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
