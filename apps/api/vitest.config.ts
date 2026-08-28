import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@api": path.resolve(__dirname, "src"),
      "@excalidraw/excalidraw": path.resolve(
        __dirname,
        "../../packages/editor-core/test/mocks/excalidraw.ts"
      ),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["test/**/*.spec.ts"],
    exclude: ["test/**/*.integration.spec.ts"],
  },
})
