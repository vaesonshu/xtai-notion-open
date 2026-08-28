import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: [
      // 更具体的子路径 alias 必须排在包根路径之前
      {
        find: "@xtai-notion/editor-shadcn/style.css",
        replacement: path.resolve(
          __dirname,
          "../../packages/editor-shadcn/src/style.css"
        ),
      },
      {
        find: /^@xtai-notion\/editor-core\/(.+)$/,
        replacement: path.resolve(
          __dirname,
          "../../packages/editor-core/src/core/$1"
        ),
      },
      {
        find: "@xtai-notion/editor-core",
        replacement: path.resolve(
          __dirname,
          "../../packages/editor-core/src/index.ts"
        ),
      },
      {
        find: /^@xtai-notion\/editor-react\/collaboration\/(.+)$/,
        replacement: path.resolve(
          __dirname,
          "../../packages/editor-react/src/collaboration/$1"
        ),
      },
      {
        find: /^@xtai-notion\/editor-react\/(.+)$/,
        replacement: path.resolve(
          __dirname,
          "../../packages/editor-react/src/react/$1"
        ),
      },
      {
        find: "@xtai-notion/editor-react",
        replacement: path.resolve(
          __dirname,
          "../../packages/editor-react/src/index.ts"
        ),
      },
      {
        find: "@xtai-notion/editor-shadcn",
        replacement: path.resolve(
          __dirname,
          "../../packages/editor-shadcn/src/index.ts"
        ),
      },
      {
        find: "@excalidraw/excalidraw/index.css",
        replacement: path.resolve(__dirname, "test/mocks/empty.css"),
      },
      {
        find: "@excalidraw/excalidraw",
        replacement: path.resolve(
          __dirname,
          "../../packages/editor-core/test/mocks/excalidraw.ts"
        ),
      },
    ],
  },
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
})
