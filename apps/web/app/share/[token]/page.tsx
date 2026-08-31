"use client"

import { Spinner } from "@workspace/ui/components/spinner"
import { useAuth } from "../../../components/auth-provider"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toastError } from "@/lib/toast"

function getToken(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default function ShareAcceptancePage() {
  const params = useParams<{ token?: string | string[] }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const token = getToken(params.token)
  const returnTo = useMemo(
    () => (token ? `/share/${encodeURIComponent(token)}` : "/documents"),
    [token]
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !token) return
    const shareToken = token

    if (!user) {
      // Keep the opaque token in a same-origin path so login can resume this
      // acceptance flow without ever trusting an external redirect target.
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`)
      return
    }

    let cancelled = false
    async function acceptShare() {
      try {
        const response = await fetch(
          `/share/${encodeURIComponent(shareToken)}/accept`,
          {
            method: "POST",
            credentials: "include",
          }
        )
        const body = (await response.json().catch(() => null)) as {
          documentId?: string
          message?: string
        } | null

        if (response.status === 401) {
          router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`)
          return
        }
        if (!response.ok || !body?.documentId) {
          throw new Error(body?.message || "无法接受分享链接")
        }

        if (!cancelled) router.replace(`/documents/${body.documentId}`)
      } catch (caught) {
        if (cancelled) return
        const message =
          caught instanceof Error ? caught.message : "无法接受分享链接"
        toastError(caught, message)
        setError(message)
      }
    }

    void acceptShare()
    return () => {
      cancelled = true
    }
  }, [authLoading, returnTo, router, token, user])

  if (error) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4">
        <p className="max-w-md text-center text-sm text-destructive">{error}</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center">
      <Spinner />
    </main>
  )
}
