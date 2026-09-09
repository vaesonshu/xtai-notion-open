"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@workspace/ui/components/spinner"
import { useAuth } from "../../components/auth-provider"

export default function WorkspacesLayout({
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

  return children
}
