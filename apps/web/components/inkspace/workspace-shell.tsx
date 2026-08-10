"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  DocumentWorkspace,
  type DocumentWorkspaceProps,
} from "./document-workspace"
import { WorkspaceSidebar } from "./sidebar"

type CreatedDocumentResponse = { id: string }

export type WorkspaceShellProps = {
  documentId: string
  user: DocumentWorkspaceProps["user"]
  apiUrl: string
  collaborationUrl: string
}

function getCreationError(error: unknown): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "无法连接到文档服务，请确认 API 已启动。"
  }
  return error instanceof Error ? error.message : "新建文档失败。"
}

export function WorkspaceShell({
  documentId,
  user,
  apiUrl,
  collaborationUrl,
}: WorkspaceShellProps) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function createDocument() {
    setCreating(true)
    setCreateError(null)
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/documents`, {
        method: "POST",
        headers: { "x-dev-user-id": user.id },
      })
      if (!response.ok) {
        throw new Error(`新建文档失败 (${response.status})`)
      }
      const document = (await response.json()) as CreatedDocumentResponse
      if (!document.id) {
        throw new Error("新建文档响应无效")
      }
      router.push(`/documents/${document.id}`)
    } catch (error) {
      setCreateError(getCreationError(error))
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <WorkspaceSidebar
        onCreateDocument={createDocument}
        creatingDocument={creating}
        createError={createError}
      />
      <main className="flex min-w-0 flex-1 flex-col bg-[#FCFCFA] !text-[#242321]">
        <DocumentWorkspace
          documentId={documentId}
          user={user}
          apiUrl={apiUrl}
          collaborationUrl={collaborationUrl}
        />
      </main>
    </>
  )
}
