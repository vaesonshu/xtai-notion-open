"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type PublicUser = { id: string; name: string; color?: string } | null

// AuthStatus is a small client component that displays the current user state
// and provides a logout button. It relies on the backend /auth/me and /auth/logout
// endpoints and includes credentials so the session cookie is sent.
export function AuthStatus() {
  const router = useRouter()
  const [user, setUser] = useState<PublicUser | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load current user on mount. Undefined means not yet loaded; null means
    // explicitly unauthenticated.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
    void fetch(`${apiUrl.replace(/\/$/, "")}/auth/me`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setUser(body ?? null))
      .catch(() => setUser(null))
  }, [])

  async function logout() {
    setLoading(true)
    setError(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error(`Logout failed (${res.status})`)
      // Refresh the app so session-backed client components update.
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // While user is undefined we show nothing to avoid a flash of "login" in
  // layouts that immediately query the server; the caller can place this into
  // a visible area and the effect will replace it shortly after mount.
  if (user === undefined) return null

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
      <button
        className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-60"
        onClick={() => void logout()}
        disabled={loading}
      >
        注销
      </button>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  )
}
