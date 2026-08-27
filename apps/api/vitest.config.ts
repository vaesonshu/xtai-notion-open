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
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.spec.ts"],
    exclude: ["src/**/*.integration.spec.ts"],
  },
})
