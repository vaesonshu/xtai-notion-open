"use client"

import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import type { WorkspaceAiProvider } from "@/lib/article-agent-types"
import {
  fetchBridgeHealth,
  LOCAL_CODEX_BRIDGE_BASE,
  saveBridgeWorkspaceRoot,
} from "@/lib/local-codex-bridge"
import { toast, toastError } from "@/lib/toast"
import {
  fetchWorkspaceAiSettings,
  updateWorkspaceAiSettings,
} from "@/lib/workspace-api"

/** 知识库 AI 写作配置表单，供个人中心等页面复用。 */
export function WorkspaceAiSettingsPanel({
  workspaceId,
  userId,
  canManage,
  onSaved,
}: {
  workspaceId: string
  userId: string
  canManage: boolean
  onSaved?: () => void
}) {
  const [aiProvider, setAiProvider] = useState<WorkspaceAiProvider>("cloud")
  const [localCodexPrompt, setLocalCodexPrompt] = useState("")
  const [localRoot, setLocalRoot] = useState("")
  const [bridgeOnline, setBridgeOnline] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [settings, health] = await Promise.all([
          fetchWorkspaceAiSettings(workspaceId, userId),
          fetchBridgeHealth(),
        ])
        if (cancelled) return
        setAiProvider(settings.aiProvider)
        setLocalCodexPrompt(settings.localCodexPrompt ?? "")
        setBridgeOnline(health.ok)

        if (health.ok) {
          try {
            const configResponse = await fetch(
              `${LOCAL_CODEX_BRIDGE_BASE}/config`
            )
            if (configResponse.ok) {
              const config = (await configResponse.json()) as {
                workspaces?: Record<string, { localRoot?: string }>
              }
              setLocalRoot(config.workspaces?.[workspaceId]?.localRoot ?? "")
            }
          } catch {
            setLocalRoot("")
          }
        } else {
          setLocalRoot("")
        }
      } catch (error) {
        if (!cancelled) toastError(error, "加载 AI 设置失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, userId])

  async function handleSave() {
    if (!canManage) return
    setSaving(true)
    try {
      await updateWorkspaceAiSettings(workspaceId, userId, {
        aiProvider,
        localCodexPrompt: localCodexPrompt.trim() || undefined,
      })
      if (aiProvider === "local_codex" && bridgeOnline) {
        await saveBridgeWorkspaceRoot(workspaceId, localRoot.trim())
      }
      toast("AI 设置已保存")
      onSaved?.()
    } catch (error) {
      toastError(error, "保存失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-[#78746C]">加载中…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="ai-provider">写作引擎</Label>
        <Select
          value={aiProvider}
          onValueChange={(value) => setAiProvider(value as WorkspaceAiProvider)}
          disabled={!canManage}
        >
          <SelectTrigger id="ai-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cloud">云端 AI（服务器）</SelectItem>
            <SelectItem value="local_codex">
              本地 Codex（读取本机资料）
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-[#78746C]">
          本地模式需在本机运行{" "}
          <code className="rounded bg-[#F3F2EF] px-1">pnpm codex-bridge</code>
          ；资料目录为可选项，仅保存在你的电脑上。
        </p>
      </div>

      {aiProvider === "local_codex" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="local-root">本地资料目录（可选）</Label>
          <Input
            id="local-root"
            value={localRoot}
            onChange={(event) => setLocalRoot(event.target.value)}
            placeholder="留空则仅基于当前文档与联网检索写作"
            disabled={!canManage || !bridgeOnline}
          />
          <p className="text-xs text-[#78746C]">
            Bridge 状态：{bridgeOnline ? "已连接" : "未连接"}。配置目录后 Codex
            可额外读取本机文件作为参考。
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="local-prompt">写作规范（可选）</Label>
        <Textarea
          id="local-prompt"
          value={localCodexPrompt}
          onChange={(event) => setLocalCodexPrompt(event.target.value)}
          placeholder="例如：使用学术语气，引用处标注来源"
          rows={4}
          disabled={!canManage}
        />
      </div>

      {canManage ? (
        <div className="flex justify-end">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "保存中…" : "保存 AI 设置"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-[#78746C]">
          仅知识库所有者或管理员可修改 AI 设置。
        </p>
      )}
    </div>
  )
}
