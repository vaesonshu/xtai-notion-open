import { defineConfig } from "tsup"

// 外部化运行时依赖，避免把 Tiptap/Yjs 打进单包
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
})
