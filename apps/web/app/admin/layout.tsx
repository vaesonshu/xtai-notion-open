"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@workspace/ui/components/spinner"
import { useAuth } from "@/components/auth-provider"
import { toast } from "@/lib/toast"

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`)
      return
    }
    // 仅管理员可进入后台；role 来自 /auth/me 持久化记录。
    if (user.role !== "admin") {
      toast.error("无权访问后台管理")
      router.replace("/documents")
    }
  }, [loading, pathname, router, user])

  if (loading || !user || user.role !== "admin") {
    return (
      <div
        role="status"
        className="flex min-h-svh items-center justify-center bg-[#f8faf8]"
      >
        <Spinner />
      </div>
    )
  }

  return <div className="min-h-svh w-full">{children}</div>
}
