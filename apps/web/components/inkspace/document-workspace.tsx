"use client"

import type { CollaborationUser } from "@workspace/editor"
import type { CreateProvider } from "@workspace/editor/collaboration"
import { DocumentEditor } from "@workspace/editor/components"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { useEffect, useState } from "react"
import { DocumentPane } from "./document"
import { EditorToolbar } from "./toolbar"
import { FixedEditorToolbar } from "./fixed-toolbar"
import { createDocumentImageUploader } from "./image-upload"

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
}

type DocumentRole = "owner" | "editor" | "viewer"

type DocumentMetadataResponse = {
  id: string
  role: DocumentRole
  title?: string
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
): Promise<DocumentRole> {
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
  return body.role
}

export function DocumentWorkspace({
  documentId,
  user,
  apiUrl,
  collaborationUrl,
  createProvider,
  title,
  parentTitle,
}: DocumentWorkspaceProps) {
  const [role, setRole] = useState<DocumentRole | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const configured = isConfigured(apiUrl, collaborationUrl)

  useEffect(() => {
    if (!configured) {
      return
    }

    let cancelled = false

    void fetchDocumentRole(apiUrl, documentId, user.id)
      .then((nextRole) => {
        if (!cancelled) {
          setRole(nextRole)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRole(null)
          setLoadError(getLoadErrorMessage(error))
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

  return (
    <DocumentEditor
      collaboration={{
        documentId,
        websocketUrl: collaborationUrl,
        token: user.id,
        user,
      }}
      editable={editable}
      imageUpload={imageUpload}
      createProvider={createProvider}
      renderToolbar={() => <FixedEditorToolbar />}
      className="flex min-h-0 flex-1 flex-col"
      renderSurface={(surface) => <DocumentPane>{surface}</DocumentPane>}
    >
      <EditorToolbar
        title={title}
        parentTitle={parentTitle}
        apiUrl={apiUrl}
        documentId={documentId}
        canShare={editable}
      />
    </DocumentEditor>
  )
}
