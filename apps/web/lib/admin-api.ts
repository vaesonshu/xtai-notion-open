import { apiRequest, apiRequestJson } from "./api-client"

/** 管理后台 API 客户端：与现有文档页一致，开发环境用 x-dev-user-id，生产走 cookie。 */

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

export async function fetchAdminStats(
  userId: string
): Promise<AdminDashboardStats> {
  return apiRequestJson({
    path: "/admin/dashboard/stats",
    userId,
  })
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
  return apiRequestJson({
    path: `/admin/articles${suffix}`,
    userId,
  })
}

export async function fetchAdminCategories(userId: string): Promise<string[]> {
  return apiRequestJson({
    path: "/admin/articles/categories",
    userId,
  })
}

export async function fetchAdminUsers(
  userId: string
): Promise<AdminUserRecord[]> {
  return apiRequestJson({
    path: "/admin/users",
    userId,
  })
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
  return apiRequestJson({
    path: "/admin/users",
    method: "POST",
    userId,
    json: body,
  })
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
  return apiRequestJson({
    path: `/admin/users/${targetUserId}`,
    method: "PATCH",
    userId,
    json: body,
  })
}

export async function deleteAdminUser(
  userId: string,
  targetUserId: string
): Promise<void> {
  const response = await apiRequest({
    path: `/admin/users/${targetUserId}`,
    method: "DELETE",
    userId,
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `删除失败 (${response.status})`)
  }
}
