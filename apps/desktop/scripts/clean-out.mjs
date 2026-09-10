import { rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "release")

try {
  // Windows may briefly lock app.asar after a dev run; retry before failing make.
  rmSync(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
} catch (error) {
  const code = error && typeof error === "object" ? error.code : undefined
  if (code === "EBUSY" || code === "EPERM") {
    console.error(
      "无法清理 apps/desktop/release：请先关闭 XtAi Notion / electron-forge 开发窗口，"
    )
    console.error(
      "在任务管理器中结束 Electron 相关进程后，再执行 pnpm --filter desktop make。"
    )
    process.exit(1)
  }
  throw error
}
