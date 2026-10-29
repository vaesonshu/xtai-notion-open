"use client"

import { useAuth } from "../../components/auth-provider"
import { LibraryListPage } from "../../components/libraries/library-list-page"

export default function LibrariesPage() {
  const { user } = useAuth()
  // 未登录不渲染列表，与 /workspaces 一致。
  if (!user) return null
  return <LibraryListPage userId={user.id} />
}
