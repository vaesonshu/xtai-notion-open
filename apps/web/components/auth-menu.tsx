"use client"

import Link from "next/link"
import { useAuthOptional } from "./auth-provider"
import { LogOutIcon, UserRoundIcon } from "@workspace/icons"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useState } from "react"
import { toast } from "sonner"

function getInitials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

// AuthMenu keeps the authenticated account controls in one place so the header
// can render the live avatar and sign-out affordance without hard-coded data.
export function AuthMenu() {
  const auth = useAuthOptional()
  const [busy, setBusy] = useState(false)

  // If the provider is missing in a narrow test harness, fall back to the
  // logged-out state instead of crashing the whole toolbar tree.
  const user = auth?.user ?? null
  const providerLoading = auth?.loading ?? false
  const refresh = auth?.refresh ?? (async () => undefined)

  async function logout() {
    setBusy(true)
    try {
      // Logout must clear the cookie on the same origin that created it.
      const res = await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error(`Logout failed (${res.status})`)
      await refresh()
      // Use a hard navigation to discard the protected route in both the app
      // router and isolated test harnesses that render this component.
      window.location.assign("/login")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (providerLoading) {
    return <div className="size-8 animate-pulse rounded-full bg-muted" />
  }

  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/login" />}
        nativeButton={false}
      >
        登录
      </Button>
    )
  }

  return (
    <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full border border-border bg-white shadow-sm hover:bg-muted"
            />
          }
        >
          <Avatar className="size-8">
            <AvatarFallback
              className="text-white"
              style={{ backgroundColor: user.color ?? "#242321" }}
            >
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuItem className="pointer-events-none opacity-100 focus:bg-transparent">
            <UserRoundIcon />
            <span>{user.name}</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onClick={() => void logout()}>
            <LogOutIcon />
            <span>{busy ? "注销中..." : "注销"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  )
}
