/** 浏览器端 API 封装：/auth 走同源代理，其余走 NEXT_PUBLIC_API_URL。 */

const SAME_ORIGIN_API_PREFIXES = ["/auth/", "/api/", "/share/"]

export function getClientApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")
}

/** 将相对路径解析为浏览器可请求的完整 URL。 */
export function buildClientApiUrl(
  path: string,
  options?: { sameOrigin?: boolean }
): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  // 经 Next 代理或 Route Handler 的同源路径不应拼 NEXT_PUBLIC_API_URL。
  if (
    options?.sameOrigin ||
    SAME_ORIGIN_API_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  ) {
    return normalized
  }
  return `${getClientApiBase()}${normalized}`
}

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  path: string
  /** 传入时自动 JSON 序列化并设置 content-type */
  json?: unknown
  /** 原始 body（如 FormData）；与 json 互斥，json 优先 */
  body?: BodyInit | null
  /** 开发环境身份头；生产环境仍依赖 cookie */
  userId?: string
  /** 强制走 web 同源 Route Handler，不拼 NEXT_PUBLIC_API_URL */
  sameOrigin?: boolean
}

function mergeRequestHeaders(options: ApiRequestOptions): Headers {
  const headers = new Headers(options.headers)
  if (options.json !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }
  if (options.userId && !headers.has("x-dev-user-id")) {
    headers.set("x-dev-user-id", options.userId)
  }
  return headers
}

/** 统一 fetch：默认携带 cookie，支持 JSON body 与 dev user 头。 */
export async function apiRequest(
  options: ApiRequestOptions
): Promise<Response> {
  const { path, json, body, userId: _userId, sameOrigin, ...init } = options
  return fetch(buildClientApiUrl(path, { sameOrigin }), {
    ...init,
    credentials: init.credentials ?? "include",
    headers: mergeRequestHeaders(options),
    body: json !== undefined ? JSON.stringify(json) : body,
  })
}

/** 从 API 错误响应中提取 message 字段，供页面 toast 复用。 */
export async function readApiErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: string
  } | null
  return body?.message || fallback
}

/** 在 apiRequest 基础上解析 JSON，非 2xx 时抛出带 message 的 Error。 */
export async function apiRequestJson<T>(
  options: ApiRequestOptions
): Promise<T> {
  const response = await apiRequest(options)
  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(response, `请求失败 (${response.status})`)
    )
  }
  return response.json() as Promise<T>
}
