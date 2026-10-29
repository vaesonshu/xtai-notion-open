"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@workspace/ui/components/spinner"
import { useAuth } from "../../components/auth-provider"
import { WorkspaceShell } from "../../components/inkspace/workspace-shell"

export default function LibrariesLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading || user) return
    router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`)
  }, [loading, pathname, router, user])

  // 未登录时与 /workspaces 一样不渲染资料库内容，只显示跳转登录前的占位。
  if (loading || !user) {
    return (
      <div
        role="status"
        className="flex min-h-svh items-center justify-center bg-[#F8F8F6]"
      >
        <Spinner />
      </div>
    )
  }

  return (
    <div
      data-pencil-page
      className="flex h-svh min-h-0 w-full overflow-hidden bg-[#F8F8F6] !text-[#242321]"
    >
      <WorkspaceShell
        user={{ ...user, color: user.color ?? "#24866B" }}
        apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ""}
        collaborationUrl={process.env.NEXT_PUBLIC_COLLABORATION_URL ?? ""}
        activeNav="libraries"
      >
        {children}
      </WorkspaceShell>
    </div>
  )
}
