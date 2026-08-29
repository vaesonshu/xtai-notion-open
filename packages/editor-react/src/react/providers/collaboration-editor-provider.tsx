"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import * as Y from "yjs"
import {
  createCollaborationSession,
  type CreateProvider,
} from "@xtai-notion/editor-react/collaboration/create-collaboration-session"
import type {
  CollaborationConfig,
  CollaborationStatus,
} from "@xtai-notion/editor-react/collaboration/types"
import { BlockEditor } from "@xtai-notion/editor-core"
import { createStarterBlocks } from "@xtai-notion/editor-core/block-schema/documents"
import type { Block } from "@xtai-notion/editor-core/block-schema/types"
import type { CollaborationUser } from "@xtai-notion/editor-core"
import type { Node } from "@tiptap/core"
import type { EditorSchema } from "@xtai-notion/editor-core/schema"
import type { ImageUploadHandler } from "@xtai-notion/editor-core/image-upload"
import type { CanvasImageFetchHandler } from "@xtai-notion/editor-core/canvas/canvas-files"
import {
  EditorContext,
  type RebindVisibleEditorInput,
} from "../context/editor-context"
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

function readCanvasEditors(
  provider: HocuspocusProvider
): Map<string, CollaborationUser> {
  const awareness = provider.awareness
  const editors = new Map<string, CollaborationUser>()
  if (!awareness) {
    return editors
  }

  awareness.getStates().forEach((state, clientId) => {
    const canvasEditing = state.canvasEditing
    const user = state.user
    if (
      clientId === awareness.clientID ||
      !canvasEditing ||
      typeof canvasEditing !== "object" ||
      typeof canvasEditing.canvasId !== "string" ||
      !user ||
      typeof user !== "object" ||
      typeof user.id !== "string" ||
      typeof user.name !== "string" ||
      typeof user.color !== "string"
    ) {
      return
    }

    editors.set(canvasEditing.canvasId, {
      id: user.id,
      name: user.name,
      color: user.color,
    })
  })

  return editors
}

function createSyncedBlockEditor(options: {
  document: Y.Doc
  provider: HocuspocusProvider
  user: CollaborationUser
  editable: boolean
  initialContent?: Block[]
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
  imageUploadNode?: Node
  canvasBlockNode?: Node
  editorSchema?: EditorSchema
}): BlockEditor {
  const wasEmpty = isRemoteDocumentEmpty(options.document)
  return new BlockEditor({
    initialContent: wasEmpty
      ? (options.initialContent ?? createStarterBlocks())
      : undefined,
    applyInitialContent: wasEmpty,
    editable: options.editable,
    editorSchema: options.editorSchema,
    extensions: {
      document: options.document,
      provider: options.provider,
      user: options.user,
      imageUpload: options.imageUpload,
      canvasImageFetch: options.canvasImageFetch,
      imageUploadNode: options.imageUploadNode,
      canvasBlockNode: options.canvasBlockNode,
    },
  })
}

export function CollaborationEditorProvider({
  collaboration,
  createProvider,
  initialContent,
  imageUpload,
  canvasImageFetch,
  imageUploadNode,
  canvasBlockNode,
  editorSchema,
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
  const [canvasEditors, setCanvasEditors] = useState<
    Map<string, CollaborationUser>
  >(new Map())
  const [blockEditor, setBlockEditor] = useState<BlockEditor | null>(null)
  const blockEditorRef = useRef<BlockEditor | null>(null)
  const createOptionsRef = useRef({
    editable,
    initialContent,
    imageUpload,
    canvasImageFetch,
    imageUploadNode,
    canvasBlockNode,
    editorSchema,
  })
  const mountGenerationRef = useRef(0)
  // fork 期间锁定 editable，避免父组件 props 把只读草稿冲掉
  const visibleEditableLockRef = useRef<boolean | null>(null)

  useEffect(() => {
    createOptionsRef.current = {
      editable,
      initialContent,
      imageUpload,
      canvasImageFetch,
      imageUploadNode,
      canvasBlockNode,
      editorSchema,
    }
  }, [
    canvasBlockNode,
    canvasImageFetch,
    editable,
    editorSchema,
    imageUpload,
    imageUploadNode,
    initialContent,
  ])

  useEffect(() => {
    const provider = session.provider
    provider.setAwarenessField("user", collaboration.user)

    const ensureEditor = () => {
      if (blockEditorRef.current || session.getStatus() !== "synced") {
        return
      }
      const nextEditor = createSyncedBlockEditor({
        document: session.document,
        provider: session.provider,
        user: collaboration.user,
        editable: createOptionsRef.current.editable,
        initialContent: createOptionsRef.current.initialContent,
        imageUpload: createOptionsRef.current.imageUpload,
        canvasImageFetch: createOptionsRef.current.canvasImageFetch,
        imageUploadNode: createOptionsRef.current.imageUploadNode,
        canvasBlockNode: createOptionsRef.current.canvasBlockNode,
        editorSchema: createOptionsRef.current.editorSchema,
      })
      blockEditorRef.current = nextEditor
      setBlockEditor(nextEditor)
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
      setCanvasEditors(readCanvasEditors(provider))
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

  const setCanvasEditing = useCallback(
    (canvasId: string | null) => {
      session.provider.setAwarenessField(
        "canvasEditing",
        canvasId ? { canvasId } : null
      )
    },
    [session]
  )

  const getCanvasEditor = useCallback(
    (canvasId: string) => canvasEditors.get(canvasId) ?? null,
    [canvasEditors]
  )

  const rebindVisibleEditor = useCallback(
    (input: RebindVisibleEditorInput) => {
      const options = createOptionsRef.current
      visibleEditableLockRef.current =
        input.target === "fork" ? input.editable : null
      const nextEditor =
        input.target === "fork"
          ? new BlockEditor({
              applyInitialContent: false,
              editable: input.editable,
              editorSchema: options.editorSchema,
              extensions: {
                document: input.document,
                imageUpload: options.imageUpload,
                canvasImageFetch: options.canvasImageFetch,
                imageUploadNode: options.imageUploadNode,
                canvasBlockNode: options.canvasBlockNode,
              },
            })
          : new BlockEditor({
              applyInitialContent: false,
              editable: input.editable,
              editorSchema: options.editorSchema,
              extensions: {
                document: session.document,
                provider: session.provider,
                user: collaboration.user,
                imageUpload: options.imageUpload,
                canvasImageFetch: options.canvasImageFetch,
                imageUploadNode: options.imageUploadNode,
                canvasBlockNode: options.canvasBlockNode,
              },
            })
      blockEditorRef.current = nextEditor
      setBlockEditor(nextEditor)
      return nextEditor
    },
    [collaboration.user, session]
  )

  useEffect(() => {
    blockEditor?.setEditable(visibleEditableLockRef.current ?? editable)
  }, [editable, blockEditor])

  useEffect(() => {
    if (!blockEditor || !onChange) {
      return
    }
    return blockEditor.onChange(onChange)
  }, [blockEditor, onChange])

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
    if (!blockEditor) {
      return
    }
    return () => {
      blockEditor.destroy()
      if (blockEditorRef.current === blockEditor) {
        blockEditorRef.current = null
      }
    }
  }, [blockEditor])

  return (
    <EditorContext
      value={{
        blockEditor,
        collaborationStatus: status,
        collaborators,
        collaborationUser: collaboration.user,
        setCanvasEditing,
        getCanvasEditor,
        rebindVisibleEditor,
      }}
    >
      {children}
    </EditorContext>
  )
}
