++"use client"
+
import React, { createContext, useCallback, useContext, useEffect, useState } from "react"

type PublicUser = { id: string; name: string; color?: string } | null

type AuthContextValue = {
  user: PublicUser
  loading: boolean
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// AuthProvider loads current user on mount and provides helpers to refresh it.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser>(undefined as unknown as PublicUser)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/me`, {
        credentials: "include",
      })
      const body = res.ok ? await res.json() : null
      setUser(body ?? null)
    } catch (e) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <AuthContext.Provider value={{ user, loading, refresh: load }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
