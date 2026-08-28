import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "src/core"),
      "@excalidraw/excalidraw": path.resolve(
        __dirname,
        "test/mocks/excalidraw.ts"
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
  },
})
