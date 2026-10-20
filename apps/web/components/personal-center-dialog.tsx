"use client"

import { useEffect, useState } from "react"
import { SquarePenIcon, UserRoundIcon } from "@workspace/icons"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { useAuthOptional } from "@/components/auth-provider"
import { WorkspaceAiSettingsPanel } from "@/components/inkspace/workspace-ai-settings-panel"
import {
  usePersonalCenter,
  type PersonalCenterSection,
} from "@/components/personal-center-context"
import { canManageWorkspace, WORKSPACE_ROLE_LABELS } from "@/lib/workspace-api"

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

const NAV_ITEMS: {
  id: PersonalCenterSection
  label: string
  icon: typeof UserRoundIcon
}[] = [
  { id: "profile", label: "个人信息", icon: UserRoundIcon },
  { id: "ai", label: "AI 设置", icon: SquarePenIcon },
]

function PersonalCenterNav({
  activeSection,
  onSelect,
}: {
  activeSection: PersonalCenterSection
  onSelect: (section: PersonalCenterSection) => void
}) {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = activeSection === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
              active
                ? "bg-[#E6F3EC] text-[#24866B]"
                : "text-[#242321] hover:bg-[#F3F2EF]"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

function PersonalProfileSection({
  name,
  color,
  userId,
  role,
}: {
  name: string
  color?: string
  userId: string
  role?: "user" | "admin"
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-[#242321]">个人信息</h2>
        <p className="mt-1 text-sm text-[#78746C]">
          查看当前登录账户的基本资料。
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-[#ECEAE4] bg-[#FCFCFB] px-5 py-4">
        <Avatar className="size-14">
          <AvatarFallback
            className="text-lg text-white"
            style={{ backgroundColor: color ?? "#242321" }}
          >
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[#242321]">
            {name}
          </p>
          <p className="mt-1 text-sm text-[#78746C]">
            {role === "admin" ? "系统管理员" : "普通用户"}
          </p>
        </div>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[#ECEAE4] px-4 py-3">
          <dt className="text-xs font-semibold tracking-wide text-[#78746C] uppercase">
            用户 ID
          </dt>
          <dd className="mt-1 truncate font-mono text-sm text-[#242321]">
            {userId}
          </dd>
        </div>
        <div className="rounded-lg border border-[#ECEAE4] px-4 py-3">
          <dt className="text-xs font-semibold tracking-wide text-[#78746C] uppercase">
            账户类型
          </dt>
          <dd className="mt-1 text-sm text-[#242321]">
            {role === "admin" ? "管理员" : "标准用户"}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function resolveDefaultWorkspaceId(
  currentWorkspaceId: string | null,
  workspaces: ReturnType<typeof usePersonalCenter>["workspaces"]
): string {
  return (
    currentWorkspaceId ??
    workspaces.find((item) => canManageWorkspace(item.role))?.id ??
    workspaces[0]?.id ??
    ""
  )
}

function PersonalAiSettingsSection({
  userId,
  workspaces,
  currentWorkspaceId,
  onRefreshWorkspaces,
}: {
  userId: string
  workspaces: ReturnType<typeof usePersonalCenter>["workspaces"]
  currentWorkspaceId: string | null
  onRefreshWorkspaces?: () => void
}) {
  // 空字符串表示未选，避免 Select value 在 undefined 与 string 间切换（受控/非受控告警）
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(() =>
    resolveDefaultWorkspaceId(currentWorkspaceId, workspaces)
  )

  useEffect(() => {
    setSelectedWorkspaceId(
      resolveDefaultWorkspaceId(currentWorkspaceId, workspaces)
    )
  }, [currentWorkspaceId, workspaces])

  const selectedWorkspace = workspaces.find(
    (item) => item.id === selectedWorkspaceId
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-[#242321]">AI 设置</h2>
        <p className="mt-1 text-sm text-[#78746C]">
          按知识库配置云端或本地 Codex；在文档页「智能体」中基于当前文档写作或新建文章。
        </p>
      </div>

      {workspaces.length === 0 ? (
        <p className="text-sm text-[#78746C]">暂无知识库</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-workspace">知识库</Label>
            <Select
              value={selectedWorkspaceId}
              onValueChange={(value) => setSelectedWorkspaceId(value ?? "")}
            >
              <SelectTrigger id="ai-workspace" className="max-w-md">
                <SelectValue placeholder="选择知识库" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                    {canManageWorkspace(workspace.role) ? "" : "（只读）"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWorkspace ? (
              <p className="text-xs text-[#78746C]">
                你的角色：{WORKSPACE_ROLE_LABELS[selectedWorkspace.role]}
              </p>
            ) : null}
          </div>

          {selectedWorkspace && selectedWorkspaceId !== "" ? (
            <WorkspaceAiSettingsPanel
              key={selectedWorkspaceId}
              workspaceId={selectedWorkspaceId}
              userId={userId}
              canManage={canManageWorkspace(selectedWorkspace.role)}
              onSaved={() => onRefreshWorkspaces?.()}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

/** 宽版个人中心：左侧菜单切换个人信息、AI 设置等面板。 */
export function PersonalCenterDialog() {
  const auth = useAuthOptional()
  const {
    open,
    setOpen,
    activeSection,
    setActiveSection,
    userId,
    workspaces,
    currentWorkspaceId,
    onRefreshWorkspaces,
  } = usePersonalCenter()

  const user = auth?.user ?? null
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton
        className="flex max-h-[85vh] w-[min(920px,calc(100%-2rem))] max-w-[920px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[920px]"
      >
        <DialogTitle className="sr-only">个人中心</DialogTitle>

        <div className="flex min-h-[480px] flex-1">
          <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#ECEAE4] bg-[#FCFCFB]">
            <div className="border-b border-[#ECEAE4] px-4 py-4">
              <p className="text-sm font-semibold text-[#242321]">个人中心</p>
              <p className="mt-0.5 truncate text-xs text-[#78746C]">
                {user.name}
              </p>
            </div>
            <PersonalCenterNav
              activeSection={activeSection}
              onSelect={setActiveSection}
            />
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
            {activeSection === "profile" ? (
              <PersonalProfileSection
                name={user.name}
                color={user.color}
                userId={userId}
                role={user.role}
              />
            ) : (
              <PersonalAiSettingsSection
                userId={userId}
                workspaces={workspaces}
                currentWorkspaceId={currentWorkspaceId}
                onRefreshWorkspaces={onRefreshWorkspaces}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
