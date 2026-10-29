"use client"

import { useParams } from "next/navigation"
import { useAuth } from "../../../components/auth-provider"
import { LibraryDetailPage } from "../../../components/libraries/library-detail-page"

export default function LibraryDetailRoute() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const { user } = useAuth()
  // 未登录不渲染详情，与 /workspaces 一致。
  if (!libraryId || !user) return null
  return <LibraryDetailPage libraryId={libraryId} userId={user.id} />
}
