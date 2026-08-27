import { copyFileSync, mkdirSync } from "node:fs"
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  onSuccess: async () => {
    // 构建后将样式复制到 dist，供 npm 消费者 import
    mkdirSync("dist", { recursive: true })
    copyFileSync("src/style.css", "dist/style.css")
  },
})
