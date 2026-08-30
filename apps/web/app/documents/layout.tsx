"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@workspace/ui/components/spinner"
import { useAuth } from "../../components/auth-provider"

export default function DocumentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading || user) return
    // Preserve the requested document URL so a completed login returns here.
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

  return (
    <div
      data-pencil-page
      className="flex h-svh min-h-0 w-full overflow-hidden bg-[#F8F8F6] !text-[#242321]"
    >
      {children}
    </div>
  )
}
