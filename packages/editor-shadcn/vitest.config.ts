import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@shadcn-src",
        replacement: path.resolve(rootDir, "src"),
      },
      {
        find: "@xtai-notion/editor-shadcn/style.css",
        replacement: path.resolve(rootDir, "./src/style.css"),
      },
      {
        find: /^@xtai-notion\/editor-core\/(.+)$/,
        replacement: path.resolve(rootDir, "../editor-core/src/core/$1"),
      },
      {
        find: "@xtai-notion/editor-core",
        replacement: path.resolve(rootDir, "../editor-core/src/index.ts"),
      },
      {
        find: /^@xtai-notion\/editor-react\/collaboration\/(.+)$/,
        replacement: path.resolve(
          rootDir,
          "../editor-react/src/collaboration/$1"
        ),
      },
      {
        find: /^@xtai-notion\/editor-react\/(.+)$/,
        replacement: path.resolve(rootDir, "../editor-react/src/react/$1"),
      },
      {
        find: "@xtai-notion/editor-react",
        replacement: path.resolve(rootDir, "../editor-react/src/index.ts"),
      },
      {
        find: "@excalidraw/excalidraw",
        replacement: path.resolve(
          rootDir,
          "../editor-core/test/mocks/excalidraw.ts"
        ),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
})
