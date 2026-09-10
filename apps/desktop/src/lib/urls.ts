export const DEV_WEB_URL = "http://localhost:3000"

export const DEV_WEB_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const

export type WindowOpenAction = "load-in-window" | "open-external" | "deny"

export function getAppLoadUrl(
  isPackaged: boolean,
  packagedAppUrl: string
): string {
  if (!isPackaged) return DEV_WEB_URL
  return packagedAppUrl.replace(/\/$/, "")
}

export function assertHttpsAppUrl(raw: string | undefined): string {
  const trimmed = raw?.trim().replace(/\/$/, "") ?? ""
  if (!trimmed) {
    throw new Error("XT_DESKTOP_APP_URL is required for packaging")
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error("XT_DESKTOP_APP_URL must be a valid https URL")
  }
  if (parsed.protocol !== "https:") {
    throw new Error("XT_DESKTOP_APP_URL must be an https URL")
  }
  return trimmed
}

export function isAllowedNavigationUrl(
  rawUrl: string,
  allowedOrigins: string[]
): boolean {
  try {
    return allowedOrigins.includes(new URL(rawUrl).origin)
  } catch {
    return false
  }
}

export function getAllowedOrigins(input: {
  isPackaged: boolean
  packagedAppUrl: string
  viteDevServerUrl?: string
}): string[] {
  if (input.isPackaged) {
    return [new URL(input.packagedAppUrl).origin]
  }
  const origins: string[] = [...DEV_WEB_ORIGINS]
  if (input.viteDevServerUrl) {
    try {
      origins.push(new URL(input.viteDevServerUrl).origin)
    } catch {
      // Ignore malformed Vite URLs; Next origins still apply.
    }
  }
  return origins
}

export function resolveWindowOpenAction(
  rawUrl: string,
  allowedOrigins: string[]
): WindowOpenAction {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return "deny"
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "deny"
  }
  if (isAllowedNavigationUrl(rawUrl, allowedOrigins)) {
    return "load-in-window"
  }
  return "open-external"
}
