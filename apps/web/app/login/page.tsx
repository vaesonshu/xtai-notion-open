"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

// Simple login page to authenticate against the API. The form posts to
// /auth/login and includes credentials so the session cookie is set by the
// backend. On success we navigate back to the root.
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || `登录失败 (${res.status})`)
      }
      // On success the server sets a HttpOnly session cookie. We navigate to
      // the root which will now be able to read session-backed endpoints.
      router.push("/")
      // ensure any client components pick up the new session
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F8F6]">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded bg-white p-6 shadow-sm border border-gray-100"
      >
        <h1 className="mb-4 text-xl font-medium">登录</h1>
        <label className="mb-2 block text-sm text-gray-700">
          邮箱
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>

        <label className="mb-4 block text-sm text-gray-700">
          密码
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>

        {error ? (
          <div className="mb-3 text-sm text-red-600">{error}</div>
        ) : null}

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </div>
      </form>
    </div>
  )
}
