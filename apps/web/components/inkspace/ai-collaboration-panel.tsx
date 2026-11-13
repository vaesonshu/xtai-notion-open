"use client"

import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { WorkspaceAiSettings } from "@/lib/article-agent-types"
import {
  getAgentUnavailableMessage,
  isAgentAvailable,
  resolveArticleAgentMode,
  type ArticleAgentMode,
} from "@/lib/article-agent"
import { useEffect, useState } from "react"
import { AiAssistantPanel } from "./ai-assistant-panel"
import { isDocumentAgentUiEnabled } from "@/lib/product-features"
import { DocumentAgentPanel } from "./document-agent-panel"

export type AiCollaborationTab = "assistant" | "agent"

export type AiCollaborationPanelProps = {
  open: boolean
  tab: AiCollaborationTab
  onTabChange: (tab: AiCollaborationTab) => void
  onClose: () => void
  apiUrl: string
  documentId: string
  userId: string
  getDocumentText: () => string
  documentTitle?: string
  workspaceId?: string
  workspaceName?: string
  aiSettings?: WorkspaceAiSettings
  canWrite?: boolean
}

/** 侧栏 AI 面板：助手（问答）与智能体（文档写作 / 新建文章）分 Tab。 */
export function AiCollaborationPanel({
  open,
  tab,
  onTabChange,
  onClose,
  workspaceId,
  workspaceName,
  aiSettings,
  canWrite = true,
  ...assistantProps
}: AiCollaborationPanelProps) {
  const [agentMode, setAgentMode] = useState<ArticleAgentMode | null>(null)

  useEffect(() => {
    if (!open || tab !== "agent" || !aiSettings) {
      setAgentMode(null)
      return
    }
    let cancelled = false
    setAgentMode(null)
    void resolveArticleAgentMode(aiSettings.aiProvider).then((mode) => {
      if (!cancelled) setAgentMode(mode)
    })
    return () => {
      cancelled = true
    }
  }, [aiSettings, open, tab])

  if (!open) return null

  const activeTab = isDocumentAgentUiEnabled ? tab : "assistant"
  const showCodexBadge = aiSettings?.aiProvider === "local_codex"
  const agentReady =
    Boolean(workspaceId && workspaceName && aiSettings) &&
    agentMode !== null &&
    isAgentAvailable(agentMode)
  const agentUnavailableMessage =
    aiSettings && agentMode !== null && !isAgentAvailable(agentMode)
      ? getAgentUnavailableMessage(agentMode, aiSettings.aiProvider)
      : null

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 min-w-0 shrink-0 flex-col border-l border-[#E8E6E1] bg-white",
        activeTab === "agent"
          ? "w-[min(520px,100vw)]"
          : "w-[min(420px,100vw)]"
      )}
      aria-label="AI 协作"
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        {isDocumentAgentUiEnabled ? (
          <div
            className="flex rounded-lg border border-[#ECEAE4] bg-[#FCFCFB] p-0.5"
            role="tablist"
            aria-label="AI 功能"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "assistant"}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === "assistant"
                  ? "bg-white text-[#242321] shadow-sm"
                  : "text-[#78746C] hover:text-[#242321]"
              )}
              onClick={() => onTabChange("assistant")}
            >
              助手
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "agent"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === "agent"
                  ? "bg-white text-[#242321] shadow-sm"
                  : "text-[#78746C] hover:text-[#242321]"
              )}
              onClick={() => onTabChange("agent")}
            >
              智能体
              {showCodexBadge ? (
                <Badge
                  variant="secondary"
                  className="!bg-[#EEF8F4] px-1.5 py-0 text-[10px] !text-[#24866B]"
                >
                  Codex
                </Badge>
              ) : null}
            </button>
          </div>
        ) : (
          <span className="text-sm font-medium text-[#242321]">AI 助手</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="关闭 AI 面板"
        >
          关闭
        </Button>
      </div>

      {activeTab === "assistant" ? (
        <AiAssistantPanel
          {...assistantProps}
          open={open}
          embedded
          active
          onClose={onClose}
        />
      ) : agentReady ? (
        <DocumentAgentPanel
          active
          workspaceId={workspaceId!}
          workspaceName={workspaceName!}
          aiSettings={aiSettings!}
          userId={assistantProps.userId}
          documentTitle={assistantProps.documentTitle}
          getDocumentText={assistantProps.getDocumentText}
          canWrite={canWrite}
        />
      ) : (
        <div className="p-4 text-sm leading-6 text-[#78746C]">
          {agentMode === null && aiSettings
            ? "正在检测 Codex 连接…"
            : (agentUnavailableMessage ??
              "当前文档未关联知识库，无法使用智能体。请先在侧边栏选择知识库。")}
        </div>
      )}
    </aside>
  )
}
