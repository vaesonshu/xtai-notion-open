import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import type { BridgeConfig, BridgeWorkspaceMapping } from "./types.js"

export const DEFAULT_BRIDGE_PORT = 3847

const CONFIG_DIR = join(homedir(), ".inkspace")
const CONFIG_PATH = join(CONFIG_DIR, "codex-bridge.json")

export function defaultBridgeConfig(): BridgeConfig {
  return { port: DEFAULT_BRIDGE_PORT, workspaces: {} }
}

/** 读取本机 bridge 配置；本地资料路径仅存此处，不上传云端。 */
export async function loadBridgeConfig(): Promise<BridgeConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<BridgeConfig>
    return {
      port:
        typeof parsed.port === "number" && parsed.port > 0
          ? parsed.port
          : DEFAULT_BRIDGE_PORT,
      workspaces:
        parsed.workspaces && typeof parsed.workspaces === "object"
          ? parsed.workspaces
          : {},
    }
  } catch {
    return defaultBridgeConfig()
  }
}

export async function saveBridgeConfig(config: BridgeConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8")
}

export async function upsertWorkspaceMapping(
  workspaceId: string,
  mapping: BridgeWorkspaceMapping
): Promise<BridgeConfig> {
  const config = await loadBridgeConfig()
  const trimmedRoot = mapping.localRoot?.trim()
  const next: BridgeWorkspaceMapping = {
    ...(mapping.allowedReadGlobs?.length
      ? { allowedReadGlobs: mapping.allowedReadGlobs }
      : {}),
    ...(trimmedRoot ? { localRoot: trimmedRoot } : {}),
  }
  if (Object.keys(next).length === 0) {
    delete config.workspaces[workspaceId]
  } else {
    config.workspaces[workspaceId] = next
  }
  await saveBridgeConfig(config)
  return config
}

export function getConfigPath(): string {
  return CONFIG_PATH
}
