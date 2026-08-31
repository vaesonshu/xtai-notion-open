"use client"

import type { CollaborationUser } from "@xtai-notion/editor-core"
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
import { toast, toastError } from "@/lib/toast"
import { DocumentPane } from "./document"
import { EditorToolbar } from "./toolbar"
import { FixedEditorToolbar } from "./fixed-toolbar"
import {
  createDocumentCanvasImageFetcher,
  createDocumentImageUploader,
} from "./image-upload"
import { AiAssistantPanel } from "./ai-assistant-panel"
import { AiWritingHost } from "./ai-writing-host"
import { BlockStructureDebugger } from "./block-structure-debugger"

const showBlockStructureDebugger = process.env.NODE_ENV === "development"

export type DocumentWorkspaceUser = CollaborationUser

export type DocumentWorkspaceProps = {
  documentId: string
  user: DocumentWorkspaceUser
  apiUrl: string
  collaborationUrl: string
  /** Optional provider factory for tests; omit in production. */
  createProvider?: CreateProvider
  title?: string
  parentTitle?: string
  /** 点击提及链接时的跳转动作；省略时回退为浏览器默认跳转。 */
  mentionNavigate?: MentionNavigate
}

type DocumentRole = "owner" | "editor" | "viewer"

type DocumentMetadataResponse = {
  id: string
  role: DocumentRole
  title?: string
  publicationStatus?: "draft" | "pending" | "published"
}

function isConfigured(apiUrl: string, collaborationUrl: string): boolean {
  return apiUrl.trim().length > 0 && collaborationUrl.trim().length > 0
}

function isDocumentRole(value: unknown): value is DocumentRole {
  return value === "owner" || value === "editor" || value === "viewer"
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "无法连接到文档服务，请确认 API 已启动。"
  }
  return error instanceof Error ? error.message : "Failed to load document"
}

async function fetchDocumentRole(
  apiUrl: string,
  documentId: string,
  userId: string
): Promise<DocumentMetadataResponse> {
  const response = await fetch(
    `${apiUrl.replace(/\/$/, "")}/documents/${documentId}`,
    {
      headers: {
        "x-dev-user-id": userId,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to load document metadata (${response.status})`)
  }

  const body = (await response.json()) as DocumentMetadataResponse
  if (!isDocumentRole(body.role)) {
    throw new Error("Invalid document role in API response")
  }
  return body
}

type MentionableDocument = { id: string; title: string }

/**
 * 拉取用户可见的全部文档，供 @ 提及使用。结果在组件生命周期内缓存，
 * 避免每次键入都重新请求；提及菜单在本地按查询过滤。
 */
function useMentionProvider(
  apiUrl: string,
  userId: string,
  excludeDocumentId?: string
): MentionProvider {
  const [documents, setDocuments] = useState<MentionableDocument[]>([])

  useEffect(() => {
    if (!apiUrl) return
    let cancelled = false
    void fetch(`${apiUrl.replace(/\/$/, "")}/documents`, {
      credentials: "include",
      headers: { "x-dev-user-id": userId },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((items: Array<{ id: string; title?: string }>) => {
        if (cancelled) return
        setDocuments(
          items
            .filter((item) => item.id !== excludeDocumentId)
            .map((item) => ({ id: item.id, title: item.title || "未命名文档" }))
        )
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [apiUrl, userId, excludeDocumentId])

  return useCallback(
    // query 参数由 editor 端在本地过滤，这里始终返回全量候选文档。
    () =>
      documents.map((document) => ({
        id: document.id,
        title: document.title,
        href: `/documents/${document.id}`,
      })),
    [documents]
  )
}

export function DocumentWorkspace({
  documentId,
  user,
  apiUrl,
  collaborationUrl,
  createProvider,
  title,
  parentTitle,
  mentionNavigate,
}: DocumentWorkspaceProps) {
  const [role, setRole] = useState<DocumentRole | null>(null)
  const [publicationStatus, setPublicationStatus] = useState<
    "draft" | "pending" | "published"
  >("draft")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [getDocumentText, setGetDocumentText] = useState<() => string>(
    () => () => ""
  )
  const handleTextReady = useCallback(
    (reader: () => string) => setGetDocumentText(() => reader),
    []
  )

  const configured = isConfigured(apiUrl, collaborationUrl)
  const mentionProvider = useMentionProvider(apiUrl, user.id, documentId)
  const submitPublication = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiUrl.replace(/\/$/, "")}/documents/${documentId}/submit-publication`,
        {
          method: "POST",
          credentials: "include",
          headers: { "x-dev-user-id": user.id },
        }
      )
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(body?.message || `发布失败 (${response.status})`)
      }
      // The post response is authoritative, avoiding a local-only pending state.
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
  }, [apiUrl, documentId, user.id])

  useEffect(() => {
    if (!configured) {
      return
    }

    let cancelled = false

    void fetchDocumentRole(apiUrl, documentId, user.id)
      .then((metadata) => {
        if (!cancelled) {
          setRole(metadata.role)
          setPublicationStatus(metadata.publicationStatus ?? "draft")
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRole(null)
          const message = getLoadErrorMessage(error)
          toastError(error, message)
          setLoadError(message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [apiUrl, configured, documentId, user.id])

  if (!configured) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg" role="alert">
          <AlertTitle>配置错误</AlertTitle>
          <AlertDescription>
            缺少客户端端点。请设置 `NEXT_PUBLIC_API_URL` 与
            `NEXT_PUBLIC_COLLABORATION_URL` 后重新启动应用。
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

  if (!role) {
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

  const editable = role !== "viewer"
  const imageUpload = editable
    ? createDocumentImageUploader({ apiUrl, documentId, userId: user.id })
    : undefined
  const canvasImageFetch = createDocumentCanvasImageFetcher({
    apiUrl,
    documentId,
    userId: user.id,
  })

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-1 flex-row overflow-hidden"
      data-testid="document-workspace-layout"
    >
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        data-testid="editor-workspace"
      >
        <DocumentEditor
          collaboration={{
            documentId,
            websocketUrl: collaborationUrl,
            token: user.id,
            user,
          }}
          editable={editable}
          imageUpload={imageUpload}
          canvasImageFetch={canvasImageFetch}
          createProvider={createProvider}
          mentionProvider={mentionProvider}
          mentionNavigate={mentionNavigate}
          renderToolbar={() => (
            <WorkspaceToolbarBridge onTextReady={handleTextReady} />
          )}
          // The editor must shrink beside the AI panel without losing its own column layout.
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          // AiWritingHost 必须包住 EditorSurface，斜杠/气泡菜单才能读到 AiWriteHostContext
          renderSurface={(surface) => (
            <AiWritingHost
              apiUrl={apiUrl}
              documentId={documentId}
              userId={user.id}
              canWrite={editable}
            >
              <DocumentPane>{surface}</DocumentPane>
            </AiWritingHost>
          )}
        >
          <EditorToolbar
            title={title}
            parentTitle={parentTitle}
            apiUrl={apiUrl}
            documentId={documentId}
            canShare={editable}
            publicationStatus={publicationStatus}
            onPublish={editable ? () => void submitPublication() : undefined}
            aiOpen={aiOpen}
            onAiToggle={() => setAiOpen((open) => !open)}
          />
          {showBlockStructureDebugger ? <BlockStructureDebugger /> : null}
        </DocumentEditor>
      </div>
      <AiAssistantPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        apiUrl={apiUrl}
        documentId={documentId}
        userId={user.id}
        getDocumentText={getDocumentText}
      />
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
