/**
 * 服务端 Route Handler 调用 API 时必须使用绝对 URL。
 * Vercel 同域部署时 NEXT_PUBLIC_API_URL 为 "/api"，不能直接用于 Node fetch。
 */
export function resolveApiBaseUrl(request: Request): string | null {
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? "")
    .trim()
    .replace(/\/$/, "")
  if (!configured) return null

  if (/^https?:\/\//i.test(configured)) {
    return configured
  }

  const path = configured.startsWith("/") ? configured : `/${configured}`
  return new URL(path, request.url).origin + path
}

/** 拼接 API 路径；apiBase 来自 resolveApiBaseUrl。 */
export function buildApiUrl(
  request: Request,
  pathname: string
): string | null {
  const apiBase = resolveApiBaseUrl(request)
  if (!apiBase) return null
  const suffix = pathname.startsWith("/") ? pathname : `/${pathname}`
  return `${apiBase}${suffix}`
}
