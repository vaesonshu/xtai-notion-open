"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { useState } from "react"

// AuthStatus uses the AuthProvider's hook to read the current user and provides
// logout functionality. It also shows a small loading indicator while the
// provider populates the user to avoid layout flash.
export function AuthStatus() {
  const router = useRouter()
  const { user, loading: providerLoading, refresh } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function logout() {
    setBusy(true)
    setError(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error(`Logout failed (${res.status})`)
      await refresh()
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // show small placeholder during load to avoid layout shift
  if (providerLoading) return <div className="h-6 w-16 rounded bg-gray-100" />

  if (!user)
    return (
      <div>
        <Link
          href="/login"
          className="rounded-md bg-white px-3 py-1 text-sm shadow-sm border border-gray-200 hover:opacity-95"
        >
          登录
        </Link>
      </div>
    )

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium">{user.name}</span>
      <div className="relative">
        <button
          className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-60"
          onClick={() => void logout()}
          disabled={busy}
        >
          注销
        </button>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  )
}
