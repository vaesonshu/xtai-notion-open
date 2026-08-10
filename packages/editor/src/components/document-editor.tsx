"use client"

import type { CreateProvider } from "../collaboration/create-collaboration-session"
import type { CollaborationConfig } from "../collaboration/types"
import type { EditorDocument } from "../core/types"
import { CollaborationEditorProvider } from "../react/collaboration-editor-provider"
import { EditorProvider } from "../react/editor-provider"
import { CollaborationStatus } from "./collaboration-status"
import { EditorSurface } from "./editor-surface"

type DocumentEditorSharedProps = {
  editable?: boolean
  onChange?: (document: EditorDocument) => void
  className?: string
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

  const { editable, onChange, className } = props

  if ("collaboration" in props && props.collaboration) {
    return (
      <CollaborationEditorProvider
        collaboration={props.collaboration}
        editable={editable}
        onChange={onChange}
        createProvider={props.createProvider}
      >
        <div className={className}>
          <CollaborationStatus />
          <EditorSurface />
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
        <EditorSurface />
      </div>
    </EditorProvider>
  )
}
