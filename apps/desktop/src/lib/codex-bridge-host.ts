import type { Server } from "node:http"
import { DEV_WEB_ORIGINS } from "./urls"

const BRIDGE_HEALTH_URL = "http://127.0.0.1:3847/health"

let hostedServer: Server | null = null

/** Origins allowed to call the local bridge from the embedded web app. */
export function resolveBridgeCorsOrigins(packagedAppUrl: string): string[] {
  const origins = new Set<string>(DEV_WEB_ORIGINS)
  const trimmed = packagedAppUrl.trim().replace(/\/$/, "")
  if (!trimmed) return [...origins]
  try {
    origins.add(new URL(trimmed).origin)
  } catch {
    // Ignore invalid packaged URLs; dev origins still apply.
  }
  return [...origins]
}

async function isBridgeAlreadyRunning(): Promise<boolean> {
  try {
    const response = await fetch(BRIDGE_HEALTH_URL, {
      signal: AbortSignal.timeout(1500),
    })
    return response.ok
  } catch {
    return false
  }
}

export type StartCodexBridgeHostOptions = {
  packagedAppUrl: string
}

/**
 * Start Codex Bridge in the desktop main process when it is not already
 * listening (e.g. user did not run `pnpm codex-bridge` separately).
 */
export async function startCodexBridgeHost(
  options: StartCodexBridgeHostOptions
): Promise<void> {
  if (process.env.INKSPACE_DISABLE_CODEX_BRIDGE === "1") return
  if (hostedServer || (await isBridgeAlreadyRunning())) return

  try {
    const { startBridgeServer } =
      await import("@xtai-notion/codex-bridge/server")
    hostedServer = await startBridgeServer(3847, {
      corsOrigins: resolveBridgeCorsOrigins(options.packagedAppUrl),
    })
    console.info("[desktop] Codex Bridge listening on http://127.0.0.1:3847")
  } catch (error) {
    console.error("[desktop] failed to start Codex Bridge", error)
  }
}

export async function stopCodexBridgeHost(): Promise<void> {
  if (!hostedServer) return
  const server = hostedServer
  hostedServer = null
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}
