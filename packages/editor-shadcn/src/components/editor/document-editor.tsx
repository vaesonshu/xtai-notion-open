"use client"

import { useMemo, use, type ReactNode } from "react"
import { createEditorSchema } from "@xtai-notion/editor-core/schema"
import type { CreateProvider } from "@xtai-notion/editor-react/collaboration/create-collaboration-session"
import type { CollaborationConfig } from "@xtai-notion/editor-react/collaboration/types"
import type { Block } from "@xtai-notion/editor-core/block-schema/types"
import type { ImageUploadHandler } from "@xtai-notion/editor-core/image-upload"
import type { CanvasImageFetchHandler } from "@xtai-notion/editor-core/canvas/canvas-files"
import { CollaborationEditorProvider } from "@xtai-notion/editor-react/providers/collaboration-editor-provider"
import { EditorProvider } from "@xtai-notion/editor-react/providers/editor-provider"
import { EditorContext } from "@xtai-notion/editor-react/context/editor-context"
import { MentionContext } from "@xtai-notion/editor-react/providers/mention-provider"
import { EditorSurface } from "./editor-surface"
import { createCanvasBlockSpec } from "../nodes/canvas-block-node-extension"
import { ImageUploadNode } from "../nodes/image-upload-node-extension"
import { ImageUpload } from "../nodes/image-upload"
import type { MentionProvider } from "@xtai-notion/editor-core/mention"
import type { MentionNavigate } from "@xtai-notion/editor-react/providers/mention-provider"

type DocumentEditorSharedProps = {
  editable?: boolean
  onChange?: (blocks: Block[]) => void
  className?: string
  children?: ReactNode
  renderToolbar?: () => ReactNode
  renderSurface?: (surface: ReactNode) => ReactNode
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
  /** 提供 @ 提及的候选文档；省略时提及菜单不显示任何结果。 */
  mentionProvider?: MentionProvider
  /** 点击提及链接时的跳转动作；省略时回退为浏览器默认跳转。 */
  mentionNavigate?: MentionNavigate
}

export type DocumentEditorProps =
  | (DocumentEditorSharedProps & {
      content?: Block[]
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
  content?: Block[]
  collaboration?: CollaborationConfig
}) {
  if (props.content !== undefined && props.collaboration !== undefined) {
    throw new Error(
      "DocumentEditor: `content` and `collaboration` are mutually exclusive"
    )
  }
}

/** 画板 NodeView 通过 schema override 注入，替代旧的 canvasBlockNode 替换逻辑 */
function useDocumentEditorSchema(props: DocumentEditorSharedProps) {
  return useMemo(
    () =>
      createEditorSchema({
        override: {
          canvas: createCanvasBlockSpec({
            upload: props.imageUpload,
            fetchImage: props.canvasImageFetch,
          }),
        },
      }),
    [props.canvasImageFetch, props.imageUpload]
  )
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
  const editorSchema = useDocumentEditorSchema(props)
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
        canvasImageFetch={props.canvasImageFetch}
        imageUploadNode={ImageUploadNode}
        editorSchema={editorSchema}
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
      canvasImageFetch={props.canvasImageFetch}
      imageUploadNode={ImageUploadNode}
      editorSchema={editorSchema}
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
  return context?.blockEditor ? renderToolbar?.() : null
}
