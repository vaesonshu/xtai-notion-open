import { defineConfig } from "tsup"

// 外部化运行时依赖，避免把 Tiptap/Yjs 打进单包
export default defineConfig({
  // server 入口供 NestJS 等 Node 环境使用，不拉取 Excalidraw
  entry: ["src/index.ts", "src/server.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ["@excalidraw/excalidraw"],
})
