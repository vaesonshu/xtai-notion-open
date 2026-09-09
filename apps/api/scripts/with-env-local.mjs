#!/usr/bin/env node
/**
 * 加载 .env.local 后执行 Prisma CLI，供 migrate:local / prisma:studio:local 使用。
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const envLocalPath = join(apiRoot, ".env.local")

if (!existsSync(envLocalPath)) {
  console.error(
    `Missing ${envLocalPath}. Copy .env.local.example to .env.local first.`
  )
  process.exit(1)
}

config({ path: envLocalPath, override: true })

const prismaArgs = process.argv.slice(2)
if (prismaArgs.length === 0) {
  console.error("Usage: node scripts/with-env-local.mjs <prisma-subcommand> [...args]")
  process.exit(1)
}

const result = spawnSync("pnpm", ["exec", "prisma", ...prismaArgs], {
  cwd: apiRoot,
  stdio: "inherit",
  shell: true,
  env: process.env,
})

process.exit(result.status ?? 1)
