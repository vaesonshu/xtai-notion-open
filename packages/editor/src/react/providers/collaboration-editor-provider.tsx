"use client"

import { useEffect, useRef, useState } from "react"
import { Editor } from "@tiptap/core"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import * as Y from "yjs"
import {
  createCollaborationSession,
  type CreateProvider,
} from "../../collaboration/create-collaboration-session"
import type {
  CollaborationConfig,
  CollaborationStatus,
} from "../../collaboration/types"
import { createEditorExtensions } from "../../core/extensions"
import { createStarterDocument } from "../../core/document"
import type { CollaborationUser, EditorDocument } from "../../core/types"
import type { ImageUploadHandler } from "../../core/image-upload"
import { ImageUploadNode } from "../../components/nodes/image-upload-node-extension"
import { EditorContext } from "../context/editor-context"
import type { EditorProviderProps } from "./editor-provider"

export type CollaborationEditorProviderProps = EditorProviderProps & {
  collaboration: CollaborationConfig
  /** Optional provider factory for tests; omit in production. */
  createProvider?: CreateProvider
}

const COLLABORATION_FIELD = "default"

function isRemoteDocumentEmpty(document: Y.Doc): boolean {
  return document.getXmlFragment(COLLABORATION_FIELD).length === 0
}

function readCollaborators(provider: HocuspocusProvider): CollaborationUser[] {
  const awareness = provider.awareness
  if (!awareness) {
    return []
  }

  const users: CollaborationUser[] = []
  awareness.getStates().forEach((state, clientId) => {
    if (clientId === awareness.clientID) {
      return
    }
    const user = state.user
    if (
      user &&
      typeof user === "object" &&
      typeof user.id === "string" &&
      typeof user.name === "string" &&
      typeof user.color === "string"
    ) {
      users.push({
        id: user.id,
        name: user.name,
        color: user.color,
      })
    }
  })
  return users
}

function createSyncedEditor(options: {
  document: Y.Doc
  provider: HocuspocusProvider
  user: CollaborationUser
  editable: boolean
  initialContent?: EditorDocument
  imageUpload?: ImageUploadHandler
}): Editor {
  const wasEmpty = isRemoteDocumentEmpty(options.document)
  const editor = new Editor({
    extensions: createEditorExtensions({
      document: options.document,
      provider: options.provider,
      user: options.user,
      imageUpload: options.imageUpload,
      imageUploadNode: ImageUploadNode,
    }),
    editable: options.editable,
  })

  if (wasEmpty) {
    editor.commands.setContent(
      options.initialContent ?? createStarterDocument()
    )
  }

  return editor
}

export function CollaborationEditorProvider({
  collaboration,
  createProvider,
  initialContent,
  imageUpload,
  editable = true,
  onChange,
  children,
}: CollaborationEditorProviderProps) {
  const [session] = useState(() =>
    createCollaborationSession(collaboration, { createProvider })
  )
  const [status, setStatus] = useState<CollaborationStatus>(() =>
    session.getStatus()
  )
  const [collaborators, setCollaborators] = useState<CollaborationUser[]>([])
  const [editor, setEditor] = useState<Editor | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const createOptionsRef = useRef({ editable, initialContent, imageUpload })
  const mountGenerationRef = useRef(0)

  useEffect(() => {
    createOptionsRef.current = { editable, initialContent, imageUpload }
  }, [editable, imageUpload, initialContent])

  useEffect(() => {
    const provider = session.provider
    provider.setAwarenessField("user", collaboration.user)

    const ensureEditor = () => {
      if (editorRef.current || session.getStatus() !== "synced") {
        return
      }
      const nextEditor = createSyncedEditor({
        document: session.document,
        provider: session.provider,
        user: collaboration.user,
        editable: createOptionsRef.current.editable,
        initialContent: createOptionsRef.current.initialContent,
        imageUpload: createOptionsRef.current.imageUpload,
      })
      editorRef.current = nextEditor
      setEditor(nextEditor)
    }

    const syncStatus = () => {
      const nextStatus = session.getStatus()
      if (nextStatus === "synced") {
        ensureEditor()
      }
      setStatus(nextStatus)
    }
    const syncCollaborators = () => {
      setCollaborators(readCollaborators(provider))
    }

    provider.on("synced", syncStatus)
    provider.on("status", syncStatus)
    provider.on("authenticationFailed", syncStatus)
    provider.on("close", syncStatus)
    provider.on("awarenessUpdate", syncCollaborators)
    provider.on("awarenessChange", syncCollaborators)
    syncStatus()
    syncCollaborators()

    return () => {
      provider.off("synced", syncStatus)
      provider.off("status", syncStatus)
      provider.off("authenticationFailed", syncStatus)
      provider.off("close", syncStatus)
      provider.off("awarenessUpdate", syncCollaborators)
      provider.off("awarenessChange", syncCollaborators)
    }
  }, [collaboration.user, session])

  useEffect(() => {
    if (!editor) {
      return
    }
    editor.setEditable(editable)
  }, [editable, editor])

  useEffect(() => {
    if (!editor || !onChange) {
      return
    }
    const handleUpdate = () => {
      onChange(editor.getJSON() as EditorDocument)
    }
    editor.on("update", handleUpdate)
    return () => {
      editor.off("update", handleUpdate)
    }
  }, [editor, onChange])

  useEffect(() => {
    const mountGeneration = mountGenerationRef.current + 1
    mountGenerationRef.current = mountGeneration

    return () => {
      queueMicrotask(() => {
        if (mountGenerationRef.current === mountGeneration) {
          session.destroy()
        }
      })
    }
  }, [session])

  useEffect(() => {
    if (!editor) {
      return
    }
    return () => {
      editor.destroy()
      if (editorRef.current === editor) {
        editorRef.current = null
      }
    }
  }, [editor])

  return (
    <EditorContext
      value={{
        editor,
        collaborationStatus: status,
        collaborators,
      }}
    >
      {children}
    </EditorContext>
  )
}
