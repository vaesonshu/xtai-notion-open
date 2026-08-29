"use client"

import { readAiWriteSse } from "@/lib/ai-writing/client"
import { createAiWritingSession } from "@/lib/ai-writing/session"
import { blocksToAiBlockViews } from "@xtai-notion/editor-core"
import { EditorContext } from "@xtai-notion/editor-react"
import { useBlockEditor } from "@xtai-notion/editor-react/hooks/use-block-editor"
import { useCollaborationStatus } from "@xtai-notion/editor-react/hooks/use-collaboration-status"
import {
  AiWriteDraft,
  AiWriteHostContext,
  AiWritePromptBar,
  SELECTION_AI_WRITE_PRESETS,
  SLASH_AI_WRITE_PRESETS,
  type AiWritingStatus,
} from "@xtai-notion/editor-shadcn"
import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"

export type AiWritingHostProps = {
  apiUrl: string
  documentId: string
  userId: string
  /** owner/editor 为 true；viewer 为 false，不暴露 AI 入口 */
  canWrite: boolean
  children: ReactNode
}

type SessionContext = {
  cursorBlockId: string
  selectedIds: string[]
}

/** 协作同步前 blockEditor 未就绪，先透传子树避免 useBlockEditor 抛错 */
export function AiWritingHost(props: AiWritingHostProps) {
  const context = use(EditorContext)
  if (!context?.blockEditor) {
    return <>{props.children}</>
  }
  return <AiWritingHostReady {...props} />
}

function AiWritingHostReady({
  apiUrl,
  documentId,
  userId,
  canWrite,
  children,
}: AiWritingHostProps) {
  const blockEditor = useBlockEditor()
  const collaborationStatus = useCollaborationStatus()
  // 仅 owner/editor 且协作已同步时开放斜杠与气泡入口
  const aiEnabled = canWrite && collaborationStatus === "synced"

  const sessionRef = useRef<ReturnType<typeof createAiWritingSession> | null>(
    null
  )
  const sessionContextRef = useRef<SessionContext | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [uiStatus, setUiStatus] = useState<AiWritingStatus>("closed")
  const [errorMessage, setErrorMessage] = useState<string>()
  const [draftRevision, setDraftRevision] = useState(0)

  const syncUiFromSession = useCallback(() => {
    const session = sessionRef.current
    if (!session || session.status === "closed") {
      setUiStatus("closed")
      setErrorMessage(undefined)
    } else {
      setUiStatus(session.status)
      setErrorMessage(session.errorMessage)
    }
    setDraftRevision((value) => value + 1)
  }, [])

  const clearSession = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    sessionRef.current = null
    sessionContextRef.current = null
    syncUiFromSession()
  }, [syncUiFromSession])

  const guardSingleSession = useCallback(() => {
    const active = sessionRef.current
    if (active && active.status !== "closed") {
      toast.error("请先接受或拒绝当前 AI 草稿")
      return false
    }
    return true
  }, [])

  const startSession = useCallback(
    (
      mode: "slash" | "selection",
      cursorBlockId: string,
      selectedIds: string[]
    ) => {
      if (!guardSingleSession()) {
        return
      }

      sessionRef.current = createAiWritingSession({
        live: blockEditor,
        mode,
        cursorBlockId,
        selectedIds,
      })
      sessionContextRef.current = { cursorBlockId, selectedIds }
      syncUiFromSession()
    },
    [blockEditor, guardSingleSession, syncUiFromSession]
  )

  const openSlash = useCallback(() => {
    if (!aiEnabled) {
      return
    }
    const cursorBlockId =
      blockEditor.getSelectedBlocks()[0]?.id ?? blockEditor.document[0]?.id
    if (!cursorBlockId) {
      return
    }
    startSession("slash", cursorBlockId, [])
  }, [aiEnabled, blockEditor, startSession])

  const openSelection = useCallback(() => {
    if (!aiEnabled) {
      return
    }
    const selectedIds = blockEditor.getSelectedBlocks().map((block) => block.id)
    if (selectedIds.length === 0) {
      return
    }
    startSession("selection", selectedIds[0]!, selectedIds)
  }, [aiEnabled, blockEditor, startSession])

  const handlers = useMemo(
    () => (aiEnabled ? { openSlash, openSelection } : null),
    [aiEnabled, openSlash, openSelection]
  )

  const handleSubmit = useCallback(
    async (prompt: string) => {
      const session = sessionRef.current
      const requestContext = sessionContextRef.current
      if (!session || !requestContext || session.status === "closed") {
        return
      }

      session.status = "thinking"
      setUiStatus("thinking")

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch(`${apiUrl.replace(/\/$/, "")}/ai/write`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-dev-user-id": userId,
          },
          body: JSON.stringify({
            documentId,
            mode: session.mode,
            prompt,
            cursorBlockId: requestContext.cursorBlockId,
            selectedIds: requestContext.selectedIds,
            blocks: blocksToAiBlockViews(blockEditor.document),
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("AI 写作服务暂不可用")
        }

        for await (const event of readAiWriteSse(response)) {
          if (event.type === "tool_call") {
            session.applyRemoteOp(event.op)
            syncUiFromSession()
            continue
          }
          if (event.type === "done") {
            session.status = "user-reviewing"
            syncUiFromSession()
            return
          }
          if (event.type === "error") {
            session.status = "error"
            session.errorMessage = event.message
            syncUiFromSession()
            return
          }
        }

        if (session.ops.length > 0) {
          session.status = "user-reviewing"
        } else {
          session.status = "error"
          session.errorMessage = "没有可应用的改动"
        }
        syncUiFromSession()
      } catch (caught) {
        if (controller.signal.aborted) {
          session.stop()
          syncUiFromSession()
          return
        }
        session.status = "error"
        session.errorMessage =
          caught instanceof Error ? caught.message : "AI 写作服务暂不可用"
        syncUiFromSession()
      } finally {
        abortRef.current = null
      }
    },
    [apiUrl, blockEditor, documentId, syncUiFromSession, userId]
  )

  const handleAccept = useCallback(() => {
    const session = sessionRef.current
    if (!session) {
      return
    }
    const result = session.accept()
    if (!result.ok) {
      if (result.reason === "stale") {
        toast.error("文档已变化，无法应用 AI 草稿")
      }
      session.reject()
    }
    clearSession()
  }, [clearSession])

  const handleReject = useCallback(() => {
    sessionRef.current?.reject()
    clearSession()
  }, [clearSession])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    sessionRef.current?.stop()
    syncUiFromSession()
  }, [syncUiFromSession])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (sessionRef.current && sessionRef.current.status !== "closed") {
        sessionRef.current.reject()
      }
    }
  }, [])

  const session = sessionRef.current
  const presets =
    session?.mode === "selection"
      ? SELECTION_AI_WRITE_PRESETS
      : SLASH_AI_WRITE_PRESETS

  const overlay =
    typeof document !== "undefined" && uiStatus !== "closed"
      ? createPortal(
          <div
            data-testid="ai-writing-overlay"
            className="pointer-events-auto fixed inset-x-0 bottom-8 z-50 mx-auto flex w-full max-w-2xl flex-col gap-3 px-4"
          >
            {session && session.ops.length > 0 ? (
              <AiWriteDraft
                blocks={session.draftBlocks()}
                key={draftRevision}
              />
            ) : null}
            <AiWritePromptBar
              status={uiStatus}
              errorMessage={errorMessage}
              onSubmit={(value) => void handleSubmit(value)}
              onAccept={handleAccept}
              onReject={handleReject}
              onStop={handleStop}
              presets={presets}
            />
          </div>,
          document.body
        )
      : null

  return (
    <AiWriteHostContext value={handlers}>
      {children}
      {overlay}
    </AiWriteHostContext>
  )
}
