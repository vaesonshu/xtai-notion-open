import type { PublicationStatus } from "../documents/document-types"

export type AdminUserRole = "user" | "admin"

export type AdminUser = {
  id: string
  email: string
  displayName: string
  color: string
  role: AdminUserRole
  createdAt: Date
  updatedAt: Date
}

export type AdminDashboardStats = {
  publishedCount: number
  draftCount: number
  pendingCount: number
  totalUsers: number
}

export type AdminArticle = {
  id: string
  title: string
  category: string
  author: string | null
  publicationStatus: PublicationStatus
  updatedAt: Date
  publishedAt: Date | null
}
