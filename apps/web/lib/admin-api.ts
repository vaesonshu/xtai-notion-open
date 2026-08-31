/** 管理后台 API 客户端：与现有文档页一致，开发环境用 x-dev-user-id，生产走 cookie。 */
function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")
}

function adminHeaders(
  userId: string,
  init?: RequestInit
): HeadersInit {
  return {
    ...(init?.headers ?? {}),
    "x-dev-user-id": userId,
  }
}

export type AdminDashboardStats = {
  publishedCount: number
  draftCount: number
  pendingCount: number
  totalUsers: number
}

export type AdminArticleRecord = {
  id: string
  title: string
  category: string
  author: string | null
  publicationStatus: "draft" | "pending" | "published"
  updatedAt: string
  publishedAt: string | null
}

export type AdminUserRecord = {
  id: string
  email: string
  displayName: string
  color: string
  role: "user" | "admin"
  createdAt: string
  updatedAt: string
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `请求失败 (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function fetchAdminStats(
  userId: string
): Promise<AdminDashboardStats> {
  const response = await fetch(`${apiBase()}/admin/dashboard/stats`, {
    credentials: "include",
    headers: adminHeaders(userId),
  })
  return parseJson(response)
}

export async function fetchAdminArticles(
  userId: string,
  params: { status?: string; category?: string; query?: string } = {}
): Promise<AdminArticleRecord[]> {
  const search = new URLSearchParams()
  if (params.status) search.set("status", params.status)
  if (params.category) search.set("category", params.category)
  if (params.query) search.set("query", params.query)
  const suffix = search.toString() ? `?${search.toString()}` : ""
  const response = await fetch(`${apiBase()}/admin/articles${suffix}`, {
    credentials: "include",
    headers: adminHeaders(userId),
  })
  return parseJson(response)
}

export async function fetchAdminCategories(
  userId: string
): Promise<string[]> {
  const response = await fetch(`${apiBase()}/admin/articles/categories`, {
    credentials: "include",
    headers: adminHeaders(userId),
  })
  return parseJson(response)
}

export async function fetchAdminUsers(
  userId: string
): Promise<AdminUserRecord[]> {
  const response = await fetch(`${apiBase()}/admin/users`, {
    credentials: "include",
    headers: adminHeaders(userId),
  })
  return parseJson(response)
}

export async function createAdminUser(
  userId: string,
  body: {
    email: string
    password: string
    displayName: string
    role?: "user" | "admin"
  }
): Promise<AdminUserRecord> {
  const response = await fetch(`${apiBase()}/admin/users`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...adminHeaders(userId),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
  return parseJson(response)
}

export async function updateAdminUser(
  userId: string,
  targetUserId: string,
  body: {
    email?: string
    password?: string
    displayName?: string
    role?: "user" | "admin"
  }
): Promise<AdminUserRecord> {
  const response = await fetch(`${apiBase()}/admin/users/${targetUserId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      ...adminHeaders(userId),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
  return parseJson(response)
}

export async function deleteAdminUser(
  userId: string,
  targetUserId: string
): Promise<void> {
  const response = await fetch(`${apiBase()}/admin/users/${targetUserId}`, {
    method: "DELETE",
    credentials: "include",
    headers: adminHeaders(userId),
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `删除失败 (${response.status})`)
  }
}
