"use client"

import { use, type ReactNode } from "react"
import type { CreateProvider } from "../../collaboration/create-collaboration-session"
import type { CollaborationConfig } from "../../collaboration/types"
import type { EditorDocument } from "../../core/types"
import type { ImageUploadHandler } from "../../core/image-upload"
import { CollaborationEditorProvider } from "../../react/providers/collaboration-editor-provider"
import { EditorProvider } from "../../react/providers/editor-provider"
import { EditorContext } from "../../react/context/editor-context"
import { MentionContext } from "../../react/providers/mention-provider"
import { EditorSurface } from "./editor-surface"
import { ImageUpload } from "../nodes/image-upload"
import type { MentionProvider } from "../../core/mention"
import type { MentionNavigate } from "../../react/providers/mention-provider"

type DocumentEditorSharedProps = {
  editable?: boolean
  onChange?: (document: EditorDocument) => void
  className?: string
  children?: ReactNode
  renderToolbar?: () => ReactNode
  renderSurface?: (surface: ReactNode) => ReactNode
  imageUpload?: ImageUploadHandler
  /** 提供 @ 提及的候选文档；省略时提及菜单不显示任何结果。 */
  mentionProvider?: MentionProvider
  /** 点击提及链接时的跳转动作；省略时回退为浏览器默认跳转。 */
  mentionNavigate?: MentionNavigate
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
      "DocumentEditor: `content` and `collaboration` are mutually exclusive"
    )
  }
}

export function DocumentEditor(props: DocumentEditorProps) {
  assertExclusiveMode(props)

  const {
    editable,
    onChange,
    className,
    children,
    renderToolbar,
    renderSurface,
    mentionProvider,
    mentionNavigate,
  } = props
  const surface = <EditorSurface />
  const framedSurface = renderSurface ? renderSurface(surface) : surface
  const framedContent = (
    <MentionContext
      value={{
        provider: mentionProvider ?? null,
        navigate: mentionNavigate ?? null,
      }}
    >
      <div className={className}>
        <ImageUpload>
          {children}
          <EditorReadyToolbar renderToolbar={renderToolbar} />
          {framedSurface}
        </ImageUpload>
      </div>
    </MentionContext>
  )

  if ("collaboration" in props && props.collaboration) {
    return (
      <CollaborationEditorProvider
        collaboration={props.collaboration}
        editable={editable}
        imageUpload={props.imageUpload}
        onChange={onChange}
        createProvider={props.createProvider}
      >
        {framedContent}
      </CollaborationEditorProvider>
    )
  }

  return (
    <EditorProvider
      initialContent={props.content}
      editable={editable}
      imageUpload={props.imageUpload}
      onChange={onChange}
    >
      {framedContent}
    </EditorProvider>
  )
}

function EditorReadyToolbar({
  renderToolbar,
}: {
  renderToolbar?: () => ReactNode
}) {
  const context = use(EditorContext)
  return context?.editor ? renderToolbar?.() : null
}
