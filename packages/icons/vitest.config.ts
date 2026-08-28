import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@icons-src": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
})
