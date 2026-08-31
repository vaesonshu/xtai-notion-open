"use client"

import { readAiWriteSse } from "@/lib/ai-writing/client"
import { createAiWritingSession } from "@/lib/ai-writing/session"
import {
  AI_WRITE_MERGE_ORIGIN,
  blocksToAiBlockViews,
  forkYDoc,
} from "@xtai-notion/editor-core"
import { EditorContext } from "@xtai-notion/editor-react"
import { useBlockEditor } from "@xtai-notion/editor-react/hooks/use-block-editor"
import {
  AiWriteHostContext,
  AiWritePromptAnchor,
  AiWritePromptBar,
  SELECTION_AI_WRITE_PRESETS,
  SLASH_AI_WRITE_PRESETS,
  type AiWritingStatus,
} from "@xtai-notion/editor-shadcn"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  use,
  type ReactNode,
} from "react"
import { toast } from "@/lib/toast"
import type { Doc as YDoc } from "yjs"

export type AiWritingHostProps = {
  apiUrl: string
  documentId: string
  userId: string
  /** owner/editor 为 true；viewer 为 false，不暴露 AI 入口 */
  canWrite: boolean
  children: ReactNode
}

type SessionContext = {
  mode: "slash" | "selection"
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
  // 直接读 context，避免 useCollaborationStatus 在非协作 provider 下抛错；
  // 同时取出改绑与 shared Y.Doc，缺一则禁用 AI 写作
  const context = use(EditorContext)
  const collaborationStatus = context?.collaborationStatus ?? null
  const rebindVisibleEditor = context?.rebindVisibleEditor
  const sharedYDoc = context?.sharedYDoc ?? null
  // 仅 owner/editor 且协作已同步时开放斜杠与气泡入口
  const aiEnabled = canWrite && collaborationStatus === "synced"

  const sessionRef = useRef<ReturnType<typeof createAiWritingSession> | null>(
    null
  )
  const sessionContextRef = useRef<SessionContext | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // fork Y.Doc 由 Host 负责销毁；fork BlockEditor 由 provider 改绑时自动 destroy
  const forkRef = useRef<YDoc | null>(null)
  // shared update 监听器，clearSession 时反注册
  const sharedUnsubscribeRef = useRef<(() => void) | null>(null)
  // user-input 阶段也算进行中，避免在提交前再开一个会话
  const activeRef = useRef(false)
  // 连续 tool_partial 用 rAF 合并 setState；insert 仍立即 flush
  const rafIdRef = useRef<number | null>(null)
  const rafPendingRef = useRef(false)
  const [uiStatus, setUiStatus] = useState<AiWritingStatus>("closed")
  const [errorMessage, setErrorMessage] = useState<string>()

  const syncUiFromSession = useCallback(() => {
    const session = sessionRef.current
    if (!session || session.status === "closed") {
      setUiStatus("closed")
      setErrorMessage(undefined)
    } else {
      setUiStatus(session.status)
      setErrorMessage(session.errorMessage)
    }
  }, [])

  const cancelPendingUiSync = useCallback(() => {
    rafPendingRef.current = false
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }, [])

  const flushSyncUi = useCallback(() => {
    cancelPendingUiSync()
    syncUiFromSession()
  }, [cancelPendingUiSync, syncUiFromSession])

  const scheduleSyncUi = useCallback(() => {
    if (rafPendingRef.current) {
      return
    }
    rafPendingRef.current = true
    rafIdRef.current = requestAnimationFrame(() => {
      rafPendingRef.current = false
      rafIdRef.current = null
      syncUiFromSession()
    })
  }, [syncUiFromSession])

  const clearSession = useCallback(() => {
    cancelPendingUiSync()
    abortRef.current?.abort()
    abortRef.current = null
    // 解除 shared 远端监听
    sharedUnsubscribeRef.current?.()
    sharedUnsubscribeRef.current = null
    if (sessionRef.current && sessionRef.current.status !== "closed") {
      sessionRef.current.reject()
    }
    sessionRef.current = null
    sessionContextRef.current = null
    forkRef.current = null
    activeRef.current = false
    setUiStatus("closed")
    setErrorMessage(undefined)
  }, [cancelPendingUiSync])

  // 把可见编辑器改绑回 shared 并销毁 fork Y.Doc（fork BlockEditor 由 provider 自动 destroy）
  const restoreSharedEditor = useCallback(() => {
    if (rebindVisibleEditor) {
      rebindVisibleEditor({ target: "shared", editable: true })
    }
    forkRef.current?.destroy()
    forkRef.current = null
  }, [rebindVisibleEditor])

  const guardSingleSession = useCallback(() => {
    if (activeRef.current) {
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
      // 仅记录入口上下文；真正 fork 推迟到提交，避免未提交就改绑
      sessionContextRef.current = { mode, cursorBlockId, selectedIds }
      activeRef.current = true
      setUiStatus("user-input")
      setErrorMessage(undefined)
    },
    [guardSingleSession]
  )

  const openSlash = useCallback(() => {
    // 缺改绑或 shared Y.Doc 的编辑器无法承载 fork 流程
    if (!rebindVisibleEditor || !sharedYDoc) {
      toast.error("当前编辑器不支持 AI 写作")
      return
    }
    if (!aiEnabled) {
      toast.error("文档同步中，请稍后再试")
      return
    }
    const cursorBlockId =
      blockEditor.getSelectedBlocks()[0]?.id ?? blockEditor.document[0]?.id
    if (!cursorBlockId) {
      return
    }
    startSession("slash", cursorBlockId, [])
  }, [aiEnabled, blockEditor, rebindVisibleEditor, sharedYDoc, startSession])

  const openSelection = useCallback(() => {
    if (!rebindVisibleEditor || !sharedYDoc) {
      toast.error("当前编辑器不支持 AI 写作")
      return
    }
    if (!aiEnabled) {
      toast.error("文档同步中，请稍后再试")
      return
    }
    const selectedIds = blockEditor.getSelectedBlocks().map((block) => block.id)
    if (selectedIds.length === 0) {
      return
    }
    startSession("selection", selectedIds[0]!, selectedIds)
  }, [aiEnabled, blockEditor, rebindVisibleEditor, sharedYDoc, startSession])

  // 有写权限即暴露入口；未 synced 时由 openSlash/openSelection 提示用户
  const handlers = useMemo(
    () => (canWrite ? { openSlash, openSelection } : null),
    [canWrite, openSlash, openSelection]
  )

  const handleSubmit = useCallback(
    async (prompt: string) => {
      const requestContext = sessionContextRef.current
      if (!requestContext || !rebindVisibleEditor || !sharedYDoc) {
        return
      }

      // 提交瞬间可见编辑器仍绑 shared，先序列化母本快照再 fork
      const blocksPayload = blocksToAiBlockViews(blockEditor.document)
      // fork 与改绑可能抛错（Y.Doc 内存不足、TipSchema 重建失败等）；
      // 失败必须回滚到 shared 并清理，否则 activeRef 卡住、fork Y.Doc 泄漏
      try {
        const fork = forkYDoc(sharedYDoc)
        const forkEditor = rebindVisibleEditor({
          target: "fork",
          document: fork,
          editable: false,
        })
        forkRef.current = fork

        const session = createAiWritingSession({
          shared: sharedYDoc,
          fork,
          forkEditor,
          mode: requestContext.mode,
          cursorBlockId: requestContext.cursorBlockId,
          selectedIds: requestContext.selectedIds,
        })
        sessionRef.current = session

        // 监听 shared 远端更新：merge 自身写入用 AI_WRITE_MERGE_ORIGIN 标记，需忽略
        const onSharedUpdate = (update: unknown, origin: unknown) => {
          if (origin === AI_WRITE_MERGE_ORIGIN) {
            return
          }
          // 会话存活期间 shared 收到任何非 merge 写入都视为远端并发，作废草稿
          const current = sessionRef.current
          if (!current || current.status === "closed") {
            return
          }
          current.markSharedStale()
          toast.error("文档已变化，AI 草稿已失效")
          abortRef.current?.abort()
          restoreSharedEditor()
          clearSession()
        }
        sharedYDoc.on("update", onSharedUpdate)
        sharedUnsubscribeRef.current = () => {
          sharedYDoc.off("update", onSharedUpdate)
        }

        session.status = "thinking"
        session.syncForkDecorations()
        setUiStatus("thinking")

        const controller = new AbortController()
        abortRef.current = controller

        // fetch / SSE 流程独立 try/catch：abort 与服务端错误走原有错误态，不再触发清理回滚
        try {
          const response = await fetch(
            `${apiUrl.replace(/\/$/, "")}/ai/write`,
            {
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
                blocks: blocksPayload,
              }),
              signal: controller.signal,
            }
          )

          if (!response.ok) {
            throw new Error("AI 写作服务暂不可用")
          }

          for await (const event of readAiWriteSse(response)) {
            if (event.type === "tool_partial") {
              const prevLen = forkEditor.document.length
              session.applyPartial(event)
              forkEditor.tiptap.commands.focus()
              // applyPartial 内已 syncForkDecorations；此处只刷新提示条 UI
              if (forkEditor.document.length !== prevLen) {
                flushSyncUi()
              } else {
                scheduleSyncUi()
              }
              continue
            }
            if (event.type === "tool_call") {
              session.applyRemoteOp(event.op, event.toolIndex)
              // fork 编辑器无 provider，focus 仅滚动到草稿块，不广播 awareness
              forkEditor.tiptap.commands.focus()
              flushSyncUi()
              continue
            }
            if (event.type === "done") {
              session.status = "user-reviewing"
              flushSyncUi()
              return
            }
            if (event.type === "error") {
              session.status = "error"
              session.errorMessage = event.message
              flushSyncUi()
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
            // 用户主动停止或远端并发触发 abort：清理由 handleStop / shared 监听器负责
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
      } catch (caught) {
        toast.error(
          caught instanceof Error ? caught.message : "AI 写作初始化失败"
        )
        restoreSharedEditor()
        clearSession()
      }
    },
    [
      apiUrl,
      blockEditor,
      clearSession,
      documentId,
      flushSyncUi,
      rebindVisibleEditor,
      restoreSharedEditor,
      scheduleSyncUi,
      sharedYDoc,
      syncUiFromSession,
      userId,
    ]
  )

  const handleAccept = useCallback(() => {
    const session = sessionRef.current
    if (!session) {
      return
    }
    const result = session.accept()
    if (result.ok) {
      // merge 已把 fork 增量写进 shared（origin=AI_WRITE_MERGE_ORIGIN），改绑回 shared
      restoreSharedEditor()
      clearSession()
      return
    }
    if (result.reason === "merge") {
      // 合并失败：保留 fork 与审阅态，允许用户再拒绝
      toast.error("合并失败，请重试或拒绝")
      return
    }
    if (result.reason === "stale") {
      toast.error("文档已变化，无法应用 AI 草稿")
    } else if (result.reason === "empty") {
      toast.error("没有可应用的改动")
    }
    session.reject()
    restoreSharedEditor()
    clearSession()
  }, [clearSession, restoreSharedEditor])

  const handleReject = useCallback(() => {
    sessionRef.current?.reject()
    restoreSharedEditor()
    clearSession()
  }, [clearSession, restoreSharedEditor])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    const session = sessionRef.current
    session?.stop()
    // 停止后若没有任何 op，session 进入 closed：必须清理，否则 activeRef 卡住、用户被锁死
    if (session && session.status === "closed") {
      restoreSharedEditor()
      clearSession()
      return
    }
    syncUiFromSession()
  }, [clearSession, restoreSharedEditor, syncUiFromSession])

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      abortRef.current?.abort()
      if (sessionRef.current && sessionRef.current.status !== "closed") {
        sessionRef.current.reject()
      }
      forkRef.current?.destroy()
      forkRef.current = null
      sharedUnsubscribeRef.current?.()
      sharedUnsubscribeRef.current = null
    }
  }, [])

  const session = sessionRef.current
  // 提交前 session 尚未创建（sessionRef 为 null），此时 user-input 阶段需回退到入口上下文中的 mode，
  // 否则 selection 模式会错误地展示 SLASH 预设
  const effectiveMode = session?.mode ?? sessionContextRef.current?.mode
  const presets =
    effectiveMode === "selection"
      ? SELECTION_AI_WRITE_PRESETS
      : SLASH_AI_WRITE_PRESETS

  // 提示条锚在最后触及的草稿块下方；未触及任何块时回退到光标块
  const anchorBlockId =
    (session && session.lastTouchedBlockId()) ??
    sessionContextRef.current?.cursorBlockId

  const overlay =
    typeof document !== "undefined" &&
    uiStatus !== "closed" &&
    anchorBlockId ? (
      <AiWritePromptAnchor anchorBlockId={anchorBlockId}>
        <AiWritePromptBar
          status={uiStatus}
          errorMessage={errorMessage}
          onSubmit={(value) => void handleSubmit(value)}
          onAccept={handleAccept}
          onReject={handleReject}
          onStop={handleStop}
          presets={presets}
        />
      </AiWritePromptAnchor>
    ) : null

  return (
    <AiWriteHostContext value={handlers}>
      {children}
      {overlay}
    </AiWriteHostContext>
  )
}
