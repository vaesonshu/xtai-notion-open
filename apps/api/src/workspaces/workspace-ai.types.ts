export type WorkspaceAiProvider = "cloud" | "local_codex"

export type WorkspaceAiSettings = {
  aiProvider: WorkspaceAiProvider
  /** 库级写作规范，注入云端或本地 Codex 的系统提示 */
  localCodexPrompt?: string
}

export const DEFAULT_WORKSPACE_AI_SETTINGS: WorkspaceAiSettings = {
  aiProvider: "cloud",
}

/** 从 Prisma Json 解析库级 AI 配置，忽略未知字段。 */
export function parseWorkspaceAiSettings(value: unknown): WorkspaceAiSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_WORKSPACE_AI_SETTINGS }
  }
  const record = value as Record<string, unknown>
  const aiProvider =
    record.aiProvider === "local_codex" ? "local_codex" : "cloud"
  const localCodexPrompt =
    typeof record.localCodexPrompt === "string"
      ? record.localCodexPrompt.trim()
      : undefined
  return {
    aiProvider,
    ...(localCodexPrompt ? { localCodexPrompt } : {}),
  }
}

export function mergeWorkspaceAiSettings(
  current: unknown,
  patch: Partial<WorkspaceAiSettings>
): WorkspaceAiSettings {
  const base = parseWorkspaceAiSettings(current)
  const aiProvider =
    patch.aiProvider === "local_codex" || patch.aiProvider === "cloud"
      ? patch.aiProvider
      : base.aiProvider
  const prompt =
    patch.localCodexPrompt !== undefined
      ? patch.localCodexPrompt.trim()
      : base.localCodexPrompt
  return {
    aiProvider,
    ...(prompt ? { localCodexPrompt: prompt } : {}),
  }
}
