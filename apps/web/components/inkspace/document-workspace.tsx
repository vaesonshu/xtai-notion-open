"use client"

import type {
  CollaborationUser,
  CommentTextAnchor,
  DocumentCommentMarkEntry,
} from "@xtai-notion/editor-core"
import { createBlockSchemaYDoc } from "@xtai-notion/editor-core"
import type { Block } from "@xtai-notion/editor-core/block-schema/types"
import { useEditorText } from "@xtai-notion/editor-react"
import type { CreateProvider } from "@xtai-notion/editor-react/collaboration/create-collaboration-session"
import { DocumentEditor } from "@xtai-notion/editor-shadcn"
import type { MentionProvider } from "@xtai-notion/editor-core/mention"
import type { MentionNavigate } from "@xtai-notion/editor-react/providers/mention-provider"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { useCallback, useEffect, useState } from "react"
import type { Doc as YDoc } from "yjs"
import { toast, toastError } from "@/lib/toast"
import { apiRequest } from "@/lib/api-client"
import { normalizeCollaborationWebSocketUrl } from "@/lib/collaboration-url"
import { useSoloDocumentSave } from "@/lib/document-content"
import { DocumentPane } from "./document"
import { EditorToolbar } from "./toolbar"
import { FixedEditorToolbar } from "./fixed-toolbar"
import {
  createDocumentCanvasImageFetcher,
  createDocumentImageUploader,
} from "./image-upload"
import {
  AiCollaborationPanel,
  type AiCollaborationTab,
} from "./ai-collaboration-panel"
import type { WorkspaceAiSettings } from "@/lib/article-agent-types"
import { ensureDocumentAgentAccess } from "@/lib/article-agent"
import { AiWritingHost } from "./ai-writing-host"
import {
  DocumentCommentBridge,
  DocumentCommentMarkers,
  DocumentCommentsPanel,
} from "./document-inline-comments"
import { BlockStructureDebugger } from "./block-structure-debugger"

const showBlockStructureDebugger = process.env.NODE_ENV === "development"

export type DocumentWorkspaceUser = CollaborationUser

export type MentionDocumentCandidate = { id: string; title: string }

export type DocumentWorkspaceProps = {
  documentId: string
  user: DocumentWorkspaceUser
  apiUrl: string
  collaborationUrl: string
  /** Optional provider factory for tests; omit in production. */
  createProvider?: CreateProvider
  title?: string
  parentTitle?: string
  /** 侧边栏已有文档列表时传入，避免重复 GET /documents */
  mentionDocuments?: MentionDocumentCandidate[]
  /** 点击提及链接时的跳转动作；省略时回退为浏览器默认跳转。 */
  mentionNavigate?: MentionNavigate
  /** 打开 Markdown 文件选择器，由 WorkspaceShell 注入 */
  onImportMarkdown?: () => void
  /** 导入进行中时禁用工具栏按钮，避免重复提交 */
  importingMarkdown?: boolean
  workspaceId?: string
  workspaceName?: string
  aiSettings?: WorkspaceAiSettings
}

type DocumentRole = "owner" | "editor" | "viewer"
type DocumentCollaborationMode = "solo" | "realtime"

type DocumentMetadataResponse = {
  id: string
  role: DocumentRole
  title?: string
  publicationStatus?: "draft" | "pending" | "published"
  collaboration?: {
    mode: DocumentCollaborationMode
    memberCount: number
    hasActiveShareLink: boolean
  }
  /** solo 模式由 GET /documents/:id 内联返回 */
  content?: Block[]
}

function isApiConfigured(apiUrl: string): boolean {
  return apiUrl.trim().length > 0
}

function isDocumentRole(value: unknown): value is DocumentRole {
  return value === "owner" || value === "editor" || value === "viewer"
}

function isCollaborationMode(
  value: unknown
): value is DocumentCollaborationMode {
  return value === "solo" || value === "realtime"
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "无法连接到文档服务，请确认 API 已启动。"
  }
  return error instanceof Error ? error.message : "Failed to load document"
}

async function fetchDocumentMetadata(
  documentId: string,
  userId: string
): Promise<DocumentMetadataResponse> {
  const response = await apiRequest({
    path: `/documents/${documentId}`,
    userId,
  })

  if (!response.ok) {
    throw new Error(`Failed to load document metadata (${response.status})`)
  }

  const body = (await response.json()) as DocumentMetadataResponse
  if (!isDocumentRole(body.role)) {
    throw new Error("Invalid document role in API response")
  }
  if (body.collaboration && !isCollaborationMode(body.collaboration.mode)) {
    throw new Error("Invalid collaboration mode in API response")
  }
  return body
}

async function fetchDocumentContent(
  documentId: string,
  userId: string
): Promise<Block[]> {
  const response = await apiRequest({
    path: `/documents/${encodeURIComponent(documentId)}/content`,
    userId,
  })
  if (!response.ok) {
    throw new Error(`Failed to load document content (${response.status})`)
  }
  const body = (await response.json()) as { content?: Block[] }
  if (!Array.isArray(body.content)) {
    throw new Error("Invalid document content in API response")
  }
  return body.content
}

/**
 * @ 提及候选：优先复用 WorkspaceShell 的文档列表，否则回退为独立拉取。
 */
function useMentionProvider(
  mentionDocuments: MentionDocumentCandidate[] | undefined,
  apiUrl: string,
  userId: string,
  excludeDocumentId?: string
): MentionProvider {
  const [fetchedDocuments, setFetchedDocuments] = useState<
    MentionDocumentCandidate[]
  >([])

  useEffect(() => {
    if (mentionDocuments !== undefined || !apiUrl) {
      return
    }
    let cancelled = false
    void apiRequest({ path: "/documents", userId })
      .then((response) => (response.ok ? response.json() : []))
      .then((items: Array<{ id: string; title?: string }>) => {
        if (cancelled) return
        setFetchedDocuments(
          items.map((item) => ({
            id: item.id,
            title: item.title || "未命名文档",
          }))
        )
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [apiUrl, mentionDocuments, userId])

  const documents = mentionDocuments ?? fetchedDocuments

  return useCallback(
    () =>
      documents
        .filter((document) => document.id !== excludeDocumentId)
        .map((document) => ({
          id: document.id,
          title: document.title,
          href: `/documents/${document.id}`,
        })),
    [documents, excludeDocumentId]
  )
}

async function resolveSoloContent(
  documentId: string,
  userId: string,
  metadata: DocumentMetadataResponse
): Promise<Block[]> {
  if (Array.isArray(metadata.content)) {
    return metadata.content
  }
  return fetchDocumentContent(documentId, userId)
}

export function DocumentWorkspace({
  documentId,
  user,
  apiUrl,
  collaborationUrl,
  createProvider,
  title,
  parentTitle,
  mentionDocuments,
  mentionNavigate,
  onImportMarkdown,
  importingMarkdown,
  workspaceId,
  workspaceName,
  aiSettings,
}: DocumentWorkspaceProps) {
  const [role, setRole] = useState<DocumentRole | null>(null)
  const [collaborationMode, setCollaborationMode] =
    useState<DocumentCollaborationMode | null>(null)
  const [editorEpoch, setEditorEpoch] = useState(0)
  const [soloYDoc, setSoloYDoc] = useState<YDoc | null>(null)
  const [soloContentLoading, setSoloContentLoading] = useState(false)
  const [publicationStatus, setPublicationStatus] = useState<
    "draft" | "pending" | "published"
  >("draft")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPanelTab, setAiPanelTab] = useState<AiCollaborationTab>("assistant")
  const toggleAiAssistant = useCallback(() => {
    setAiOpen((open) => {
      if (open && aiPanelTab === "assistant") return false
      return true
    })
    setAiPanelTab("assistant")
  }, [aiPanelTab])
  const toggleAiAgent = useCallback(() => {
    void (async () => {
      const access = await ensureDocumentAgentAccess({
        workspaceId,
        aiProvider: aiSettings?.aiProvider,
      })
      if (!access.ok) {
        toast.error(access.message)
        return
      }
      setAiOpen((open) => {
        if (open && aiPanelTab === "agent") return false
        return true
      })
      setAiPanelTab("agent")
    })()
  }, [aiPanelTab, aiSettings, workspaceId])
  const handleAiTabChange = useCallback(
    (next: AiCollaborationTab) => {
      if (next === "assistant") {
        setAiPanelTab("assistant")
        return
      }
      void (async () => {
        const access = await ensureDocumentAgentAccess({
          workspaceId,
          aiProvider: aiSettings?.aiProvider,
        })
        if (!access.ok) {
          toast.error(access.message)
          return
        }
        setAiPanelTab("agent")
      })()
    },
    [aiSettings, workspaceId]
  )
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentAnchor, setCommentAnchor] = useState<CommentTextAnchor | null>(
    null
  )
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const [commentMarks, setCommentMarks] = useState<DocumentCommentMarkEntry[]>(
    []
  )
  const [getDocumentText, setGetDocumentText] = useState<() => string>(
    () => () => ""
  )
  const handleTextReady = useCallback(
    (reader: () => string) => setGetDocumentText(() => reader),
    []
  )
  const handleSelectionAnchorChange = useCallback(
    (anchor: CommentTextAnchor | null) => {
      if (anchor) {
        setCommentAnchor(anchor)
        setActiveCommentId(null)
      }
    },
    []
  )
  const handleCommentAnchorClear = useCallback(() => {
    setCommentAnchor(null)
  }, [])
  const handleCommentMarkClick = useCallback((commentId: string) => {
    setActiveCommentId(commentId)
    setCommentsOpen(true)
  }, [])
  const handleCommentDeleted = useCallback((commentId: string) => {
    setActiveCommentId((current) => (current === commentId ? null : current))
  }, [])

  const configured = isApiConfigured(apiUrl)
  const collaborationWebSocketUrl =
    normalizeCollaborationWebSocketUrl(collaborationUrl)
  const mentionProvider = useMentionProvider(
    mentionDocuments,
    apiUrl,
    user.id,
    documentId
  )
  const editable = role !== "viewer"
  const { status: soloSaveStatus, flush: flushSoloSave } = useSoloDocumentSave({
    documentId,
    userId: user.id,
    sharedDocument: soloYDoc,
    enabled: collaborationMode === "solo" && editable,
  })

  const submitPublication = useCallback(async () => {
    try {
      const response = await apiRequest({
        path: `/documents/${documentId}/submit-publication`,
        method: "POST",
        userId: user.id,
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(body?.message || `发布失败 (${response.status})`)
      }
      const body = (await response.json()) as DocumentMetadataResponse
      const nextStatus = body.publicationStatus ?? "pending"
      setPublicationStatus(nextStatus)
      if (nextStatus === "published") {
        toast.success("发布成功，文章已上线")
      } else if (nextStatus === "pending") {
        toast.success("已提交发布申请，等待审批")
      } else {
        toast.success("发布成功")
      }
    } catch (error) {
      toastError(error, "发布失败，请稍后重试")
    }
  }, [documentId, user.id])

  const handlePrepareShare = useCallback(async () => {
    if (collaborationMode === "solo" && editable) {
      await flushSoloSave()
    }
  }, [collaborationMode, editable, flushSoloSave])

  const handleShareEnabled = useCallback(() => {
    if (collaborationMode === "solo") {
      soloYDoc?.destroy()
      setSoloYDoc(null)
      setCollaborationMode("realtime")
      setEditorEpoch((value) => value + 1)
      toast.success("已开启分享，正在切换到实时协作")
    }
  }, [collaborationMode, soloYDoc])

  useEffect(() => {
    if (!configured || !documentId) return
    void apiRequest({
      path: `/documents/${documentId}/pref`,
      method: "PATCH",
      userId: user.id,
      json: { recordOpened: true },
    }).catch(() => undefined)
  }, [apiUrl, configured, documentId, user.id])

  useEffect(() => {
    if (!configured) {
      return
    }

    let cancelled = false
    setRole(null)
    setCollaborationMode(null)
    setSoloContentLoading(true)
    setSoloYDoc((current) => {
      current?.destroy()
      return null
    })

    void fetchDocumentMetadata(documentId, user.id)
      .then(async (metadata) => {
        if (cancelled) {
          return
        }
        const mode = metadata.collaboration?.mode ?? "solo"
        setRole(metadata.role)
        setPublicationStatus(metadata.publicationStatus ?? "draft")
        setCollaborationMode(mode)
        setLoadError(null)

        if (mode === "solo") {
          const content = await resolveSoloContent(
            documentId,
            user.id,
            metadata
          )
          if (cancelled) {
            return
          }
          setSoloYDoc(createBlockSchemaYDoc(content))
        }
        setSoloContentLoading(false)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRole(null)
          setCollaborationMode(null)
          setSoloContentLoading(false)
          const message = getLoadErrorMessage(error)
          toastError(error, message)
          setLoadError(message)
        }
      })

    return () => {
      cancelled = true
      setSoloYDoc((current) => {
        current?.destroy()
        return null
      })
    }
  }, [apiUrl, configured, documentId, user.id, editorEpoch])

  if (!configured) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg" role="alert">
          <AlertTitle>配置错误</AlertTitle>
          <AlertDescription>
            缺少客户端端点。请设置 `NEXT_PUBLIC_API_URL` 后重新启动应用。
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center p-8">
          <Alert variant="destructive" className="max-w-lg" role="alert">
            <AlertTitle>无法加载文档</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  if (
    !role ||
    !collaborationMode ||
    (collaborationMode === "solo" && (soloContentLoading || !soloYDoc))
  ) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col"
        aria-busy="true"
        role="status"
        aria-label="正在加载文档"
      >
        <div className="flex h-[68px] shrink-0 items-center border-b border-[#E8E6E1] px-6">
          <span className="h-4 w-56 animate-pulse rounded bg-[#E2DED5]" />
        </div>
        <section className="flex min-h-0 flex-1 justify-center overflow-hidden px-[72px] pt-[58px] pb-[72px]">
          <article className="flex w-[720px] max-w-full flex-col gap-5">
            <span className="h-10 w-3/4 animate-pulse rounded-md bg-[#D8D2C4]" />
            <span className="h-4 w-full animate-pulse rounded bg-[#E2DED5]" />
            <span className="h-4 w-11/12 animate-pulse rounded bg-[#E2DED5]" />
            <span className="h-4 w-4/5 animate-pulse rounded bg-[#E2DED5]" />
            <div className="mt-4 flex flex-col gap-3">
              <span className="h-4 w-full animate-pulse rounded bg-[#E8E6E1]" />
              <span className="h-4 w-10/12 animate-pulse rounded bg-[#E8E6E1]" />
              <span className="h-4 w-9/12 animate-pulse rounded bg-[#E8E6E1]" />
            </div>
          </article>
        </section>
        <span className="sr-only">正在加载文档内容</span>
      </div>
    )
  }

  if (collaborationMode === "realtime" && !collaborationWebSocketUrl) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg" role="alert">
          <AlertTitle>配置错误</AlertTitle>
          <AlertDescription>
            此文档已开启分享或多成员协作，需要配置
            `NEXT_PUBLIC_COLLABORATION_URL` 后重新启动应用。
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const imageUpload = editable
    ? createDocumentImageUploader({ apiUrl, documentId, userId: user.id })
    : undefined
  const canvasImageFetch = createDocumentCanvasImageFetcher({
    apiUrl,
    documentId,
    userId: user.id,
  })

  const editorProps =
    collaborationMode === "solo"
      ? ({
          // Loading guard above ensures soloYDoc is set; ?? undefined matches EditorProvider.
          sharedDocument: soloYDoc ?? undefined,
        } as const)
      : ({
          collaboration: {
            documentId,
            websocketUrl: collaborationWebSocketUrl,
            token: user.id,
            user,
          },
          createProvider,
        } as const)

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      data-testid="document-workspace-layout"
    >
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        data-testid="editor-workspace"
        data-collaboration-mode={collaborationMode}
      >
        <DocumentEditor
          key={`${documentId}-${collaborationMode}-${editorEpoch}`}
          {...editorProps}
          editable={editable}
          imageUpload={imageUpload}
          canvasImageFetch={canvasImageFetch}
          mentionProvider={mentionProvider}
          mentionNavigate={mentionNavigate}
          renderToolbar={() => (
            <>
              <WorkspaceToolbarBridge onTextReady={handleTextReady} />
              <DocumentCommentBridge
                commentMarks={commentMarks}
                onSelectionAnchorChange={handleSelectionAnchorChange}
                onCommentMarkClick={handleCommentMarkClick}
              />
            </>
          )}
          renderSidePanel={() => (
            <>
              <DocumentCommentsPanel
                open={commentsOpen}
                onOpenChange={setCommentsOpen}
                apiUrl={apiUrl}
                documentId={documentId}
                userId={user.id}
                commentAnchor={commentAnchor}
                onCommentAnchorClear={handleCommentAnchorClear}
                activeCommentId={activeCommentId}
                onCommentMarksChange={setCommentMarks}
                onCommentDeleted={handleCommentDeleted}
              />
              <AiCollaborationPanel
                open={aiOpen}
                tab={aiPanelTab}
                onTabChange={handleAiTabChange}
                onClose={() => setAiOpen(false)}
                apiUrl={apiUrl}
                documentId={documentId}
                userId={user.id}
                getDocumentText={getDocumentText}
                workspaceId={workspaceId}
                workspaceName={workspaceName}
                aiSettings={aiSettings}
                documentTitle={title}
                canWrite={editable}
              />
            </>
          )}
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          renderSurface={(surface) => (
            <AiWritingHost
              apiUrl={apiUrl}
              documentId={documentId}
              userId={user.id}
              canWrite={editable}
            >
              <DocumentPane>
                <DocumentCommentMarkers
                  commentMarks={commentMarks}
                  activeCommentId={activeCommentId}
                />
                {surface}
              </DocumentPane>
            </AiWritingHost>
          )}
        >
          <EditorToolbar
            title={title}
            parentTitle={parentTitle}
            apiUrl={apiUrl}
            documentId={documentId}
            userId={user.id}
            canShare={editable}
            canWrite={editable}
            publicationStatus={publicationStatus}
            onPublish={editable ? () => void submitPublication() : undefined}
            aiOpen={aiOpen}
            aiPanelTab={aiPanelTab}
            onAiAssistantToggle={toggleAiAssistant}
            onAiAgentToggle={toggleAiAgent}
            agentUsesLocalCodex={aiSettings?.aiProvider === "local_codex"}
            commentsOpen={commentsOpen}
            onCommentsToggle={() => setCommentsOpen((open) => !open)}
            onVersionRestored={() => window.location.reload()}
            onImportMarkdown={onImportMarkdown}
            importingMarkdown={importingMarkdown}
            collaborationMode={collaborationMode}
            soloSaveStatus={
              collaborationMode === "solo" ? soloSaveStatus : undefined
            }
            onPrepareShare={handlePrepareShare}
            onShareEnabled={handleShareEnabled}
          />
          {showBlockStructureDebugger ? <BlockStructureDebugger /> : null}
        </DocumentEditor>
      </div>
    </div>
  )
}

function WorkspaceToolbarBridge({
  onTextReady,
}: {
  onTextReady: (reader: () => string) => void
}) {
  const getText = useEditorText()
  useEffect(() => onTextReady(() => getText()), [getText, onTextReady])
  return <FixedEditorToolbar />
}
