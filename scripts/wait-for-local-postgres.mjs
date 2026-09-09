#!/usr/bin/env node
/**
 * 等待 docker-compose 中的 Postgres 通过 healthcheck，再执行 migrate。
 */
import { spawnSync } from "node:child_process"

const containerName = "xtai-notion-postgres"
const maxAttempts = 40
const delayMs = 1500

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function dockerInspectHealth() {
  const result = spawnSync(
    "docker",
    [
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}",
      containerName,
    ],
    { encoding: "utf8" }
  )

  if (result.status !== 0) {
    return null
  }

  return result.stdout.trim()
}

console.log(`Waiting for ${containerName} to become healthy...`)

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const status = dockerInspectHealth()

  if (status === "healthy") {
    console.log("Postgres is ready.")
    process.exit(0)
  }

  if (status === null && attempt === 1) {
    console.warn(
      "Container not found yet; ensure Docker Desktop is running and pnpm db:local:up succeeded."
    )
  }

  process.stdout.write(
    `  attempt ${attempt}/${maxAttempts}: ${status ?? "missing"}\n`
  )
  await sleep(delayMs)
}

console.error(
  `Timed out waiting for ${containerName}. Start Docker Desktop and run: pnpm db:local:up`
)
process.exit(1)
