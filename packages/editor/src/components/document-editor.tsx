"use client"

import { use, type ReactNode } from "react"
import type { CreateProvider } from "../collaboration/create-collaboration-session"
import type { CollaborationConfig } from "../collaboration/types"
import type { EditorDocument } from "../core/types"
import { CollaborationEditorProvider } from "../react/collaboration-editor-provider"
import { EditorProvider } from "../react/editor-provider"
import { EditorContext } from "../react/editor-context"
import { EditorSurface } from "./editor-surface"

type DocumentEditorSharedProps = {
  editable?: boolean
  onChange?: (document: EditorDocument) => void
  className?: string
  children?: ReactNode
  renderToolbar?: () => ReactNode
  renderSurface?: (surface: ReactNode) => ReactNode
}

export type DocumentEditorProps =
  | (DocumentEditorSharedProps & {
      content?: EditorDocument
      collaboration?: never
      createProvider?: never
    })
  | (DocumentEditorSharedProps & {
      collaboration: CollaborationConfig
      content?: never
      /** Optional provider factory for tests; omit in production. */
      createProvider?: CreateProvider
    })

function assertExclusiveMode(props: {
  content?: EditorDocument
  collaboration?: CollaborationConfig
}) {
  if (props.content !== undefined && props.collaboration !== undefined) {
    throw new Error(
      "DocumentEditor: `content` and `collaboration` are mutually exclusive",
    )
  }
}

export function DocumentEditor(props: DocumentEditorProps) {
  assertExclusiveMode(props)

  const { editable, onChange, className, children, renderToolbar, renderSurface } = props
  const surface = <EditorSurface />
  const framedSurface = renderSurface ? renderSurface(surface) : surface

  if ("collaboration" in props && props.collaboration) {
    return (
      <CollaborationEditorProvider
        collaboration={props.collaboration}
        editable={editable}
        onChange={onChange}
        createProvider={props.createProvider}
      >
        <div className={className}>
          {children}
          <EditorReadyToolbar renderToolbar={renderToolbar} />
          {framedSurface}
        </div>
      </CollaborationEditorProvider>
    )
  }

  return (
    <EditorProvider
      initialContent={props.content}
      editable={editable}
      onChange={onChange}
    >
      <div className={className}>
        {children}
        <EditorReadyToolbar renderToolbar={renderToolbar} />
        {framedSurface}
      </div>
    </EditorProvider>
  )
}

function EditorReadyToolbar({ renderToolbar }: { renderToolbar?: () => ReactNode }) {
  const context = use(EditorContext)
  return context?.editor ? renderToolbar?.() : null
}
