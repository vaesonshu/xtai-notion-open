"use client"

import type { BlockEditor } from "@xtai-notion/editor-core"
import { setDocumentAgentSelectionTarget } from "@xtai-notion/editor-core"
import { EditorContext } from "@xtai-notion/editor-react/context/editor-context"
import { useEditorSelection } from "@xtai-notion/editor-react"
import { useRouter } from "next/navigation"
import { use, useEffect, useMemo, useRef, useState } from "react"
import { FileTextIcon } from "@workspace/icons"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  applyAgentMarkdownToEditor,
  buildDocumentAgentContext,
  canReplaceEditorTarget,
  describeAgentEditorTarget,
  readAgentEditorTarget,
  toDocumentAgentSelectionTarget,
  type AgentEditorTarget,
  type DocumentWriteAction,
} from "@/lib/agent-editor-actions"
import {
  extractMarkdownTitle,
  resolveArticleAgentMode,
  streamArticle,
} from "@/lib/article-agent"
import type {
  AgentWriteScope,
  WorkspaceAiSettings,
} from "@/lib/article-agent-types"
import { toast, toastError } from "@/lib/toast"
import { importMarkdownToWorkspace } from "@/lib/workspace-api"
import { AiMarkdownContent } from "./ai-assistant-panel"

const DOCUMENT_PRESETS = [
  {
    id: "doc-continue",
    label: "续写下文",
    prompt: "根据上文语境，续写 2–3 段内容，保持语气一致。",
  },
  {
    id: "doc-polish",
    label: "润色全文",
    prompt: "在不改变核心信息的前提下润色全文，使表达更清晰流畅。",
  },
  {
    id: "doc-expand",
    label: "扩写要点",
    prompt: "将文档中的要点扩写为更完整的段落，补充必要细节。",
  },
  {
    id: "doc-tone",
    label: "改写语气",
    prompt: "将全文改写为更专业、简洁的书面语气。",
  },
] as const

const SELECTION_PRESETS = [
  {
    id: "sel-continue",
    label: "续写选中",
    prompt: "从选中内容继续写 2–3 段，保持语气一致。",
  },
  {
    id: "sel-polish",
    label: "润色选中",
    prompt: "润色选中内容，使表达更清晰流畅。",
  },
  {
    id: "sel-expand",
    label: "扩写选中",
    prompt: "扩写选中内容，补充必要细节与例子。",
  },
  {
    id: "sel-tone",
    label: "改写语气",
    prompt: "改写选中内容为更专业的书面语气。",
  },
] as const

const NEW_ARTICLE_PRESETS = [
  {
    id: "new-retro",
    label: "产品复盘",
    prompt: "结合知识库资料，写一篇结构完整的产品复盘。",
  },
  {
    id: "new-research",
    label: "调研摘要",
    prompt: "整理调研结论，输出带小节标题的 Markdown 摘要。",
  },
  {
    id: "new-proposal",
    label: "方案草案",
    prompt: "撰写一份可评审的方案草案，包含背景、目标与步骤。",
  },
] as const

function formatCharCount(length: number): string {
  if (length >= 10_000) return `${(length / 10_000).toFixed(1)} 万字`
  if (length >= 1000) return `${(length / 1000).toFixed(1)} 千字`
  return `${length} 字`
}

type AgentOutputStatus =
  | "idle"
  | "thinking"
  | "streaming"
  | "complete"
  | "error"
  | "aborted"

const OUTPUT_STATUS_LABELS: Record<AgentOutputStatus, string> = {
  idle: "等待开始",
  thinking: "智能体思考中…",
  streaming: "正在输出…",
  complete: "输出完成",
  error: "生成失败",
  aborted: "已停止",
}

type AgentMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  status: "streaming" | "complete" | "error"
}

function createMessageId(): string {
  return `agent-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 流式阶段用纯文本逐行展示，完成后再渲染 Markdown，避免半段 markdown 闪烁。 */
function AgentMessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user"
  const isStreamingAssistant =
    message.role === "assistant" && message.status === "streaming"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={cn(
          "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm",
          isUser
            ? "rounded-br-md bg-[#D9F0E3] whitespace-pre-wrap text-[#24543F]"
            : "rounded-bl-md border border-[#E8E6E1] bg-white text-[#373532]"
        )}
      >
        {isUser ? (
          message.content
        ) : isStreamingAssistant ? (
          <pre className="font-sans text-sm whitespace-pre-wrap text-[#373532]">
            {message.content || "…"}
          </pre>
        ) : message.content ? (
          <AiMarkdownContent content={message.content} />
        ) : (
          <span className="text-[#78746C]">（空回复）</span>
        )}
      </div>
    </div>
  )
}

/** 预览区顶部的 AI 状态条，提示当前生成阶段与字数。 */
function AgentOutputStatusBar({
  status,
  charCount,
}: {
  status: AgentOutputStatus
  charCount: number
}) {
  const isActive = status === "thinking" || status === "streaming"
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECEAE4] px-3 py-2">
      <div
        className="flex items-center gap-2 text-xs text-[#5E625D]"
        role="status"
        aria-live="polite"
      >
        {isActive ? (
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-1.5 animate-pulse rounded-full bg-[#78B596] motion-reduce:animate-none"
                style={{ animationDelay: `${dot * 150}ms` }}
              />
            ))}
          </span>
        ) : null}
        <span className="font-medium text-[#242321]">
          {OUTPUT_STATUS_LABELS[status]}
        </span>
      </div>
      {charCount > 0 ? (
        <span className="text-[11px] text-[#78746C]">
          已输出 {formatCharCount(charCount)}
        </span>
      ) : null}
    </div>
  )
}

/** 同步智能体选区高亮到编辑器，面板关闭或切换范围时自动清除。 */
function DocumentAgentSelectionBridge({
  blockEditor,
  editorTarget,
  enabled,
}: {
  blockEditor: BlockEditor
  editorTarget: AgentEditorTarget
  enabled: boolean
}) {
  useEffect(() => {
    if (!enabled) {
      setDocumentAgentSelectionTarget(blockEditor, null)
      return
    }

    setDocumentAgentSelectionTarget(
      blockEditor,
      toDocumentAgentSelectionTarget(editorTarget)
    )

    return () => {
      setDocumentAgentSelectionTarget(blockEditor, null)
    }
  }, [blockEditor, editorTarget, enabled])

  return null
}

export type DocumentAgentPanelProps = {
  active: boolean
  workspaceId: string
  workspaceName: string
  aiSettings: WorkspaceAiSettings
  userId: string
  documentTitle?: string
  getDocumentText: () => string
  canWrite?: boolean
}

/** 写作智能体：支持基于当前文档协作写作，也支持新建独立文章。 */
export function DocumentAgentPanel(props: DocumentAgentPanelProps) {
  if (!props.active) return null
  const context = use(EditorContext)
  if (!context?.blockEditor) {
    return <p className="px-4 py-6 text-sm text-[#78746C]">编辑器加载中…</p>
  }
  return (
    <DocumentAgentPanelReady
      {...props}
      blockEditor={context.blockEditor}
      canWrite={props.canWrite ?? true}
    />
  )
}

function DocumentAgentPanelReady({
  active,
  workspaceId,
  workspaceName,
  aiSettings,
  userId,
  documentTitle,
  getDocumentText,
  blockEditor,
  canWrite,
}: DocumentAgentPanelProps & {
  blockEditor: BlockEditor
  canWrite: boolean
}) {
  const router = useRouter()
  const selectionVersion = useEditorSelection()
  const editorTarget = useMemo(
    () => readAgentEditorTarget(blockEditor),
    [blockEditor, selectionVersion]
  )
  const [scope, setScope] = useState<AgentWriteScope>("document")
  const [documentDraft, setDocumentDraft] = useState("")
  /** 新建文档模式底部输入框，与上方表单项分离以便聊天区占满剩余高度。 */
  const [newDraft, setNewDraft] = useState("")
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const newInputRef = useRef<HTMLTextAreaElement>(null)
  const documentInputRef = useRef<HTMLTextAreaElement>(null)
  const [modeLabel, setModeLabel] = useState("")
  const [running, setRunning] = useState(false)
  const [outputStatus, setOutputStatus] = useState<AgentOutputStatus>("idle")
  const [outputComplete, setOutputComplete] = useState(false)
  const [importing, setImporting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const assistantMessageIdRef = useRef<string | null>(null)
  /** 最终 agent_message，与界面展示的完整思考过程分离，供导入/复制。 */
  const [articleOutput, setArticleOutput] = useState("")

  const latestAssistant = [...messages]
    .reverse()
    .find((item) => item.role === "assistant")
  const preview = latestAssistant?.content ?? ""
  const importMarkdown = articleOutput.trim() || preview.trim()

  const documentText = active ? getDocumentText().trim() : ""
  const documentCharCount = documentText.length
  const canReplaceSelection = canReplaceEditorTarget(editorTarget)
  // 发送时按选区推断意图；具体写入方式由底部「插入 / 替换选区」按钮决定。
  const inferredWriteAction: DocumentWriteAction = canReplaceSelection
    ? "replace"
    : "insert"

  useEffect(() => {
    if (!active) {
      abortRef.current?.abort()
      abortRef.current = null
      setRunning(false)
      setOutputStatus("idle")
      setOutputComplete(false)
      setMessages([])
      setNewDraft("")
      setDocumentDraft("")
      setArticleOutput("")
      assistantMessageIdRef.current = null
      return
    }
    void resolveArticleAgentMode(aiSettings.aiProvider).then((mode) => {
      setModeLabel(
        mode === "local_codex"
          ? "本地 Codex"
          : mode === "cloud"
            ? "云端 AI"
            : "本地 Codex（Bridge 未连接）"
      )
    })
  }, [active, aiSettings.aiProvider])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "end",
    })
  }, [messages, outputStatus])

  function updateAssistantMessage(
    updater: (current: AgentMessage) => AgentMessage
  ) {
    const assistantId = assistantMessageIdRef.current
    if (!assistantId) return
    setMessages((current) =>
      current.map((item) => (item.id === assistantId ? updater(item) : item))
    )
  }

  async function handleGenerate(messageText?: string) {
    const instruction =
      messageText?.trim() ??
      (scope === "new" ? newDraft.trim() : documentDraft.trim())
    if (!instruction || running) return
    if (scope === "document") {
      const hasCursor = editorTarget.kind !== "none"
      if (!documentText && !hasCursor) {
        toast.error("请在文档中定位光标，或切换到「新建文档」")
        return
      }
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setOutputComplete(false)
    setOutputStatus("thinking")
    setArticleOutput("")

    const userMessageId = createMessageId()
    const assistantMessageId = createMessageId()
    assistantMessageIdRef.current = assistantMessageId
    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        content: instruction,
        status: "complete",
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        status: "streaming",
      },
    ])
    if (scope === "new") {
      setNewDraft("")
    } else {
      setDocumentDraft("")
    }

    let receivedDone = false
    let hasOutput = false

    try {
      for await (const event of streamArticle({
        workspaceId,
        workspaceName,
        aiSettings,
        prompt: instruction,
        title: undefined,
        scope,
        documentText:
          scope === "document"
            ? buildDocumentAgentContext(
                documentText,
                editorTarget,
                inferredWriteAction
              )
            : undefined,
        userId,
        signal: controller.signal,
      })) {
        if (event.type === "replace") {
          hasOutput = Boolean(event.content.trim())
          setOutputStatus("streaming")
          // 旧版 Bridge 的 replace 也按追加处理，避免思考过程被覆盖。
          updateAssistantMessage((item) => ({
            ...item,
            content: item.content
              ? `${item.content}\n\n${event.content}`
              : event.content,
            status: "streaming",
          }))
        }
        if (event.type === "token") {
          hasOutput = true
          setOutputStatus("streaming")
          updateAssistantMessage((item) => ({
            ...item,
            content: item.content + event.content,
            status: "streaming",
          }))
        }
        if (event.type === "done") {
          receivedDone = true
          if (event.article?.trim()) {
            setArticleOutput(event.article.trim())
          }
        }
        if (event.type === "error") {
          throw new Error(event.message)
        }
      }

      if (receivedDone || hasOutput) {
        setOutputStatus("complete")
        setOutputComplete(true)
        updateAssistantMessage((item) => ({ ...item, status: "complete" }))
      } else {
        setOutputStatus("error")
        setOutputComplete(false)
        updateAssistantMessage((item) => ({ ...item, status: "error" }))
        toast.error("智能体未返回内容，请调整指令后重试")
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setOutputStatus("aborted")
        setOutputComplete(false)
        updateAssistantMessage((item) => ({ ...item, status: "error" }))
      } else {
        setOutputStatus("error")
        setOutputComplete(false)
        updateAssistantMessage((item) => ({ ...item, status: "error" }))
        toastError(error, scope === "document" ? "写作失败" : "生成文章失败")
      }
    } finally {
      setRunning(false)
      assistantMessageIdRef.current = null
    }
  }

  async function handleImport() {
    if (!outputComplete || !importMarkdown || importing || scope !== "new") {
      return
    }
    setImporting(true)
    try {
      const docTitle = extractMarkdownTitle(importMarkdown)
      const created = await importMarkdownToWorkspace(workspaceId, userId, {
        title: docTitle,
        markdown: importMarkdown,
      })
      toast("文章已导入知识库")
      router.push(`/documents/${created.id}`)
    } catch (error) {
      toastError(error, "导入失败")
    } finally {
      setImporting(false)
    }
  }

  async function handleCopy() {
    if (!outputComplete || !importMarkdown) return
    try {
      await navigator.clipboard.writeText(importMarkdown)
      toast("已复制到剪贴板")
    } catch {
      toast.error("复制失败，请手动选择文本")
    }
  }

  function handleApplyToEditor(action: DocumentWriteAction) {
    if (!canWrite) {
      toast.error("当前为只读模式，无法写入文档")
      return
    }
    if (!outputComplete || !importMarkdown) return
    const result = applyAgentMarkdownToEditor(
      blockEditor,
      importMarkdown,
      action
    )
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast(action === "replace" ? "已替换选区" : "已插入文档")
  }

  if (!active) return null

  // 有选区时只展示选区预设，避免与全文预设（如「改写语气」）重复出现。
  const presets =
    scope === "document"
      ? canReplaceSelection
        ? SELECTION_PRESETS
        : DOCUMENT_PRESETS
      : NEW_ARTICLE_PRESETS
  const canUseOutput = outputComplete && importMarkdown.length > 0

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="document-agent-panel"
    >
      <DocumentAgentSelectionBridge
        blockEditor={blockEditor}
        editorTarget={editorTarget}
        enabled={scope === "document"}
      />
      <div className="shrink-0 space-y-3 border-b border-[#ECEAE4] px-4 py-3">
        <div
          className="flex rounded-lg border border-[#ECEAE4] bg-[#FCFCFB] p-0.5"
          role="tablist"
          aria-label="智能体写作范围"
        >
          {(
            [
              { id: "document", label: "当前文档" },
              { id: "new", label: "新建文档" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={scope === item.id}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                scope === item.id
                  ? "bg-white text-[#242321] shadow-sm"
                  : "text-[#78746C] hover:text-[#242321]"
              )}
              onClick={() => {
                setScope(item.id)
                setMessages([])
                setNewDraft("")
                setDocumentDraft("")
                setArticleOutput("")
                setOutputStatus("idle")
                setOutputComplete(false)
                assistantMessageIdRef.current = null
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[#78746C]">
          <Badge
            variant="secondary"
            className="!bg-[#F3F2EF] px-2 py-0.5 text-[11px] !text-[#5E625D]"
          >
            {modeLabel || "检测引擎…"}
          </Badge>
          <span>{workspaceName}</span>
        </div>

        {scope === "document" ? (
          <div className="flex items-start gap-2 rounded-lg border border-[#ECEAE4] bg-[#FCFCFB] px-3 py-2.5">
            <FileTextIcon className="mt-0.5 size-4 shrink-0 text-[#78746C]" />
            <div className="min-w-0 text-xs leading-5 text-[#5E625D]">
              <p className="truncate font-medium text-[#242321]">
                {documentTitle?.trim() || "当前文档"}
              </p>
              <p>
                已读取 {formatCharCount(documentCharCount)} 正文作为写作上下文
              </p>
              <p className="text-[#78746C]">
                {describeAgentEditorTarget(editorTarget)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs leading-5 text-[#78746C]">
            生成完整 Markdown 后可导入为新文档，标题将从正文首行自动提取。
          </p>
        )}
      </div>

      {scope === "new" ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#FCFCFA]">
            <AgentOutputStatusBar
              status={outputStatus}
              charCount={preview.length}
            />
            <div
              className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
              data-testid="agent-message-scroll"
            >
              {messages.length === 0 ? (
                <div className="flex flex-wrap gap-2">
                  {presets.map((item) => (
                    <Button
                      key={item.id}
                      variant="outline"
                      size="sm"
                      className="rounded-full border-[#D8D2C4] bg-white text-xs text-[#5E625D]"
                      disabled={running}
                      onClick={() => {
                        setNewDraft(item.prompt)
                        newInputRef.current?.focus()
                      }}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              ) : (
                messages.map((message) => (
                  <AgentMessageBubble key={message.id} message={message} />
                ))
              )}
              {outputStatus === "thinking" && messages.length === 0 ? (
                <p className="text-sm text-[#78746C]" role="status">
                  智能体正在准备回复，请稍候…
                </p>
              ) : null}
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
            {outputStatus === "complete" ? (
              <div className="border-t border-[#ECEAE4] bg-[#EEF8F4] px-4 py-2 text-xs text-[#24866B]">
                输出已完成，你现在可以导入为文档。
              </div>
            ) : null}
            {outputStatus === "aborted" ? (
              <div className="border-t border-[#ECEAE4] bg-[#FFF4E5] px-4 py-2 text-xs text-[#9A6700]">
                生成已停止，请重新输入指令以获取完整结果。
              </div>
            ) : null}
            {outputStatus === "error" ? (
              <div className="border-t border-[#ECEAE4] bg-[#FDECEC] px-4 py-2 text-xs text-[#B53B30]">
                生成未完成，请修改指令后重试。
              </div>
            ) : null}
          </div>

          <div className="shrink-0 space-y-2 border-t border-[#ECEAE4] bg-white p-4">
            <Textarea
              ref={newInputRef}
              id="agent-new-input"
              value={newDraft}
              disabled={running}
              onChange={(event) => setNewDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void handleGenerate(newDraft)
                }
              }}
              placeholder="描述文章主题与要求，例如：结合本地调研笔记，写一篇产品复盘"
              aria-label="文章主题与要求"
              rows={3}
              className="min-h-[72px] resize-none"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-w-[96px] flex-1"
                onClick={() =>
                  running
                    ? abortRef.current?.abort()
                    : void handleGenerate(newDraft)
                }
                disabled={!running && !newDraft.trim()}
              >
                {running ? "停止生成" : "发送"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleImport()}
                disabled={!canUseOutput || importing || running}
                title={
                  canUseOutput ? undefined : "请等待智能体输出完成后再导入"
                }
              >
                {importing ? "导入中…" : "导入为文档"}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#FCFCFA]">
            <AgentOutputStatusBar
              status={outputStatus}
              charCount={preview.length}
            />
            <div
              className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
              data-testid="agent-message-scroll"
            >
              {messages.length === 0 ? (
                <div className="flex flex-wrap gap-2">
                  {presets.map((item) => (
                    <Button
                      key={item.id}
                      variant="outline"
                      size="sm"
                      className="rounded-full border-[#D8D2C4] bg-white text-xs text-[#5E625D]"
                      disabled={running}
                      onClick={() => {
                        setDocumentDraft(item.prompt)
                        documentInputRef.current?.focus()
                      }}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              ) : (
                messages.map((message) => (
                  <AgentMessageBubble key={message.id} message={message} />
                ))
              )}
              {outputStatus === "thinking" && messages.length === 0 ? (
                <p className="text-sm text-[#78746C]" role="status">
                  智能体正在准备回复，请稍候…
                </p>
              ) : null}
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
            {outputStatus === "complete" ? (
              <div className="border-t border-[#ECEAE4] bg-[#EEF8F4] px-4 py-2 text-xs text-[#24866B]">
                输出已完成，你可以插入、替换选区或复制结果。
              </div>
            ) : null}
            {outputStatus === "aborted" ? (
              <div className="border-t border-[#ECEAE4] bg-[#FFF4E5] px-4 py-2 text-xs text-[#9A6700]">
                生成已停止，请重新输入指令以获取完整结果。
              </div>
            ) : null}
            {outputStatus === "error" ? (
              <div className="border-t border-[#ECEAE4] bg-[#FDECEC] px-4 py-2 text-xs text-[#B53B30]">
                生成未完成，请修改指令后重试。
              </div>
            ) : null}
          </div>

          <div className="shrink-0 space-y-2 border-t border-[#ECEAE4] bg-white p-4">
            <Textarea
              ref={documentInputRef}
              id="agent-document-input"
              value={documentDraft}
              disabled={running}
              onChange={(event) => setDocumentDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void handleGenerate(documentDraft)
                }
              }}
              placeholder="描述写作任务，例如：续写结论部分，或润色选中段落"
              aria-label="写作指令"
              rows={3}
              className="min-h-[72px] resize-none"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-w-[96px] flex-1"
                onClick={() =>
                  running
                    ? abortRef.current?.abort()
                    : void handleGenerate(documentDraft)
                }
                disabled={!running && !documentDraft.trim()}
              >
                {running ? "停止生成" : "发送"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleApplyToEditor("insert")}
                disabled={!canUseOutput || running || !canWrite}
                title={
                  canUseOutput ? undefined : "请等待智能体输出完成后再写入文档"
                }
              >
                插入
              </Button>
              <Button
                variant="outline"
                onClick={() => handleApplyToEditor("replace")}
                disabled={
                  !canUseOutput || running || !canWrite || !canReplaceSelection
                }
                title={
                  canReplaceSelection
                    ? canUseOutput
                      ? undefined
                      : "请等待智能体输出完成后再写入文档"
                    : "请先在编辑器中选中文本或块"
                }
              >
                替换选区
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleCopy()}
                disabled={!canUseOutput || running}
                title={
                  canUseOutput ? undefined : "请等待智能体输出完成后再复制"
                }
              >
                复制
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
