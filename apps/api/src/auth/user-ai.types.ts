export type UserCloudAiSettings = {
  openAiApiKey?: string
  openAiBaseUrl?: string
  openAiModel?: string
}

export type UserCloudAiSettingsView = {
  openAiApiKey: string
  openAiBaseUrl: string
  openAiModel: string
  /** 是否已保存过 API Key（用于前端提示，不暴露密钥内容）。 */
  hasApiKey: boolean
}

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"

export function parseUserCloudAiSettings(value: unknown): UserCloudAiSettings {
  if (!value || typeof value !== "object") {
    return {}
  }
  const record = value as Record<string, unknown>
  const openAiApiKey =
    typeof record.openAiApiKey === "string" ? record.openAiApiKey.trim() : ""
  const openAiBaseUrl =
    typeof record.openAiBaseUrl === "string" ? record.openAiBaseUrl.trim() : ""
  const openAiModel =
    typeof record.openAiModel === "string" ? record.openAiModel.trim() : ""
  return {
    ...(openAiApiKey ? { openAiApiKey } : {}),
    ...(openAiBaseUrl ? { openAiBaseUrl } : {}),
    ...(openAiModel ? { openAiModel } : {}),
  }
}

export function mergeUserCloudAiSettings(
  current: unknown,
  patch: Partial<UserCloudAiSettings>
): UserCloudAiSettings {
  const base = parseUserCloudAiSettings(current)
  const next: UserCloudAiSettings = { ...base }

  if (patch.openAiApiKey !== undefined) {
    const trimmed = patch.openAiApiKey.trim()
    if (trimmed) next.openAiApiKey = trimmed
    else delete next.openAiApiKey
  }
  if (patch.openAiBaseUrl !== undefined) {
    const trimmed = patch.openAiBaseUrl.trim()
    if (trimmed) next.openAiBaseUrl = trimmed
    else delete next.openAiBaseUrl
  }
  if (patch.openAiModel !== undefined) {
    const trimmed = patch.openAiModel.trim()
    if (trimmed) next.openAiModel = trimmed
    else delete next.openAiModel
  }

  return next
}

export function toUserCloudAiSettingsView(
  settings: UserCloudAiSettings
): UserCloudAiSettingsView {
  return {
    openAiApiKey: "",
    openAiBaseUrl: settings.openAiBaseUrl ?? DEFAULT_OPENAI_BASE_URL,
    openAiModel: settings.openAiModel ?? "",
    hasApiKey: Boolean(settings.openAiApiKey),
  }
}
