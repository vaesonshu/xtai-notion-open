"use client"

import { useCallback, useEffect, useState } from "react"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { apiRequest, readApiErrorMessage } from "@/lib/api-client"
import { toast, toastError } from "@/lib/toast"

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer"

type WorkspaceMember = {
  userId: string
  email: string
  displayName: string
  color: string
  role: WorkspaceRole
}

type InviteCandidate = {
  userId: string
  email: string
  displayName: string
  color: string
}

const ASSIGNABLE_ROLES: Array<{ value: WorkspaceRole; label: string }> = [
  { value: "admin", label: "管理员" },
  { value: "editor", label: "编辑者" },
  { value: "viewer", label: "查看者" },
]

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "所有者",
  admin: "管理员",
  editor: "编辑者",
  viewer: "查看者",
}

function canManageMembers(role: WorkspaceRole | undefined): boolean {
  return role === "owner" || role === "admin"
}

export function WorkspaceMembersDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  currentUserId,
  currentUserRole,
  userId,
  onMembersChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string | null
  workspaceName: string
  currentUserId: string
  currentUserRole?: WorkspaceRole
  userId: string
  onMembersChanged?: () => void
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(false)
  const [inviteQuery, setInviteQuery] = useState("")
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("editor")
  const [candidates, setCandidates] = useState<InviteCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [inviting, setInviting] = useState(false)
  const manageable = canManageMembers(currentUserRole)

  const refreshMembers = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const response = await apiRequest({
        path: `/workspaces/${workspaceId}/members`,
        userId,
      })
      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, "加载成员列表失败")
        )
      }
      const items = (await response.json()) as WorkspaceMember[]
      setMembers(items)
    } catch (error) {
      toastError(error, "加载成员列表失败")
    } finally {
      setLoading(false)
    }
  }, [workspaceId, userId])

  useEffect(() => {
    if (!open || !workspaceId) return
    void refreshMembers()
  }, [open, workspaceId, refreshMembers])

  useEffect(() => {
    if (!open || !workspaceId || !manageable) {
      setCandidates([])
      return
    }
    const trimmed = inviteQuery.trim()
    if (trimmed.length < 2) {
      setCandidates([])
      return
    }

    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await apiRequest({
          path: `/workspaces/${workspaceId}/members/search?q=${encodeURIComponent(trimmed)}`,
          userId,
        })
        if (!response.ok) {
          setCandidates([])
          return
        }
        setCandidates((await response.json()) as InviteCandidate[])
      } catch {
        setCandidates([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [inviteQuery, manageable, open, workspaceId, userId])

  async function inviteMember(payload: { userId?: string; email?: string }) {
    if (!workspaceId) return
    setInviting(true)
    try {
      const response = await apiRequest({
        path: `/workspaces/${workspaceId}/members`,
        method: "POST",
        userId,
        json: { ...payload, role: inviteRole },
      })
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "邀请失败"))
      }
      setInviteQuery("")
      setCandidates([])
      await refreshMembers()
      onMembersChanged?.()
      toast.success("成员已加入知识库")
    } catch (error) {
      toastError(error, "邀请失败")
    } finally {
      setInviting(false)
    }
  }

  async function updateRole(memberUserId: string, role: WorkspaceRole) {
    if (!workspaceId) return
    try {
      const response = await apiRequest({
        path: `/workspaces/${workspaceId}/members/${memberUserId}`,
        method: "PATCH",
        userId,
        json: { role },
      })
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "更新角色失败"))
      }
      setMembers((current) =>
        current.map((item) =>
          item.userId === memberUserId ? { ...item, role } : item
        )
      )
      toast.success("角色已更新")
    } catch (error) {
      toastError(error, "更新角色失败")
    }
  }

  async function removeMember(memberUserId: string) {
    if (!workspaceId) return
    try {
      const response = await apiRequest({
        path: `/workspaces/${workspaceId}/members/${memberUserId}`,
        method: "DELETE",
        userId,
      })
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "移除成员失败"))
      }
      setMembers((current) =>
        current.filter((item) => item.userId !== memberUserId)
      )
      onMembersChanged?.()
      toast.success("成员已移除")
    } catch (error) {
      toastError(error, "移除成员失败")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{workspaceName} · 成员</DialogTitle>
        </DialogHeader>

        {manageable ? (
          <div className="space-y-2 border-b border-[#ECEAE4] pb-4">
            <p className="text-xs font-medium text-[#78746C]">邀请成员</p>
            <div className="flex gap-2">
              <Input
                placeholder="搜索邮箱或昵称"
                value={inviteQuery}
                onChange={(event) => setInviteQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && inviteQuery.includes("@")) {
                    void inviteMember({ email: inviteQuery.trim() })
                  }
                }}
              />
              <Select
                items={ASSIGNABLE_ROLES}
                value={inviteRole}
                onValueChange={(value) =>
                  setInviteRole(value as WorkspaceRole)
                }
              >
                <SelectTrigger size="sm" className="w-[100px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {searching ? (
              <p className="text-xs text-[#78746C]">搜索中…</p>
            ) : null}
            {candidates.length > 0 ? (
              <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-[#ECEAE4] p-1">
                {candidates.map((candidate) => (
                  <li key={candidate.userId}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[#F3F2EF]"
                      disabled={inviting}
                      onClick={() =>
                        void inviteMember({ userId: candidate.userId })
                      }
                    >
                      <Avatar className="size-6">
                        <AvatarFallback
                          className="text-[10px] text-white"
                          style={{ backgroundColor: candidate.color }}
                        >
                          {candidate.displayName.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate">
                        {candidate.displayName}
                      </span>
                      <span className="truncate text-xs text-[#78746C]">
                        {candidate.email}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {inviteQuery.includes("@") && candidates.length === 0 ? (
              <Button
                variant="outline"
                size="sm"
                disabled={inviting}
                onClick={() => void inviteMember({ email: inviteQuery.trim() })}
              >
                按邮箱邀请
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {loading ? (
            <p className="py-4 text-center text-sm text-[#78746C]">
              加载成员…
            </p>
          ) : members.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#78746C]">暂无成员</p>
          ) : (
            members.map((member) => {
              const isSelf = member.userId === currentUserId
              const isOwner = member.role === "owner"
              return (
                <div
                  key={member.userId}
                  className="flex items-center gap-2 rounded-lg px-1 py-2"
                >
                  <Avatar className="size-8">
                    <AvatarFallback
                      className="text-xs text-white"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.displayName.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.displayName}
                      {isSelf ? (
                        <span className="ml-1 text-xs text-[#78746C]">
                          （你）
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-[#78746C]">
                      {member.email}
                    </p>
                  </div>
                  {manageable && !isOwner ? (
                    <Select
                      items={ASSIGNABLE_ROLES}
                      value={member.role}
                      onValueChange={(value) =>
                        void updateRole(member.userId, value as WorkspaceRole)
                      }
                    >
                      <SelectTrigger size="sm" className="w-[96px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="shrink-0 text-xs text-[#78746C]">
                      {ROLE_LABELS[member.role]}
                    </span>
                  )}
                  {manageable && !isOwner && !isSelf ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-[#78746C] hover:text-destructive"
                      onClick={() => void removeMember(member.userId)}
                    >
                      移除
                    </Button>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
