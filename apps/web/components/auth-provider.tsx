"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { apiRequest } from "@/lib/api-client"

type PublicUser = {
  id: string
  name: string
  color?: string
  role?: "user" | "admin"
} | null

type AuthMeResponse = {
  id: string
  displayName?: string
  name?: string
  color?: string
  role?: "user" | "admin"
} | null

type AuthContextValue = {
  user: PublicUser
  loading: boolean
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// AuthProvider loads current user on mount and provides helpers to refresh it.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser>(null)
  const [loading, setLoading] = useState(true)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const currentRequestId = ++requestId.current
    setLoading(true)
    try {
      // Authentication stays on the web origin; Next rewrites it to the API so
      // the browser stores and sends the session cookie for one hostname.
      const res = await apiRequest({ path: "/auth/me" })
      const body = (res.ok ? await res.json() : null) as AuthMeResponse
      // The initial probe can finish after login-triggered refresh; only the
      // newest request may commit state or it can log the user back out.
      if (currentRequestId !== requestId.current) return
      if (!body || typeof body.id !== "string") {
        setUser(null)
        return
      }

      const name =
        typeof body.name === "string"
          ? body.name
          : typeof body.displayName === "string"
            ? body.displayName
            : ""

      // Normalize the API payload so downstream components can depend on a
      // stable `name` field even though the backend exposes `displayName`.
      setUser(
        name
          ? {
              id: body.id,
              name,
              color: body.color,
              role: body.role === "admin" ? "admin" : "user",
            }
          : null
      )
    } catch {
      if (currentRequestId !== requestId.current) return
      setUser(null)
    } finally {
      if (currentRequestId === requestId.current) setLoading(false)
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

export function useAuthOptional() {
  return useContext(AuthContext) ?? null
}
