import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = path.dirname(fileURLToPath(import.meta.url))
const editorCoreSrc = path.resolve(root, "../editor-core/src")

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@workspace\/editor-core\/(.*)$/,
        replacement: `${editorCoreSrc}/$1`,
      },
      {
        find: "@workspace/editor-core",
        replacement: path.resolve(editorCoreSrc, "index.ts"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
})
