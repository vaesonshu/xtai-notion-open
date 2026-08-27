"use client"

import { use, type ReactNode } from "react"
import type {
  CollaborationUser,
  CanvasImageFetchHandler,
  EditorDocument,
  ImageUploadHandler,
  MentionProvider,
} from "@xtai-notion/editor-core"
import {
  CollaborationEditorProvider,
  EditorContext,
  EditorProvider,
  MentionContext,
  type MentionNavigate,
} from "@xtai-notion/editor-react"
import type {
  CollaborationConfig,
  CreateProvider,
} from "@xtai-notion/editor-react/collaboration"
import { ShadcnEditorProvider } from "../../shadcn-editor-provider"
import { CanvasBlockNode } from "../nodes/canvas-block-node-extension"
import { ImageUploadNode } from "../nodes/image-upload-node-extension"
import { ImageUpload } from "../nodes/image-upload"
import { EditorSurface } from "./editor-surface"

type DocumentEditorSharedProps = {
  editable?: boolean
  onChange?: (document: EditorDocument) => void
  className?: string
  children?: ReactNode
  renderToolbar?: () => ReactNode
  renderSurface?: (surface: ReactNode) => ReactNode
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
  /** ?? @ ??????????????????????? */
  mentionProvider?: MentionProvider
  /** ??????????????????????????? */
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
      <ShadcnEditorProvider>
        <CollaborationEditorProvider
          collaboration={props.collaboration}
          editable={editable}
          imageUpload={props.imageUpload}
          canvasImageFetch={props.canvasImageFetch}
          imageUploadNode={ImageUploadNode}
          canvasBlockNode={CanvasBlockNode}
          onChange={onChange}
          createProvider={props.createProvider}
        >
          {framedContent}
        </CollaborationEditorProvider>
      </ShadcnEditorProvider>
    )
  }

  return (
    <ShadcnEditorProvider>
      <EditorProvider
        initialContent={props.content}
        editable={editable}
        imageUpload={props.imageUpload}
        canvasImageFetch={props.canvasImageFetch}
        imageUploadNode={ImageUploadNode}
        canvasBlockNode={CanvasBlockNode}
        onChange={onChange}
      >
        {framedContent}
      </EditorProvider>
    </ShadcnEditorProvider>
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
