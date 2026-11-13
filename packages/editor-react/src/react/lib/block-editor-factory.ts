import type { Node } from "@tiptap/core"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import type { Doc as YDoc } from "yjs"
import {
  BlockEditor,
  createStarterBlocks,
  type CollaborationUser,
} from "@xtai-notion/editor-core"
import type { Block } from "@xtai-notion/editor-core/model/types"
import type { EditorSchema } from "@xtai-notion/editor-core/schema"
import type { ImageUploadHandler } from "@xtai-notion/editor-core/image-upload"
import type { CanvasImageFetchHandler } from "@xtai-notion/editor-core/canvas/canvas-files"
import type { RebindVisibleEditorInput } from "../context/editor-context"

/** 与 editor-core Collaboration 扩展一致的 Yjs 片段字段名。 */
export const DEFAULT_COLLABORATION_XML_FIELD = "default"

/** 判断远端/共享 Y.Doc 是否尚无块内容，用于决定是否灌入 initialContent。 */
export function isYjsCollaborationFragmentEmpty(
  document: YDoc,
  field = DEFAULT_COLLABORATION_XML_FIELD
): boolean {
  return document.getXmlFragment(field).length === 0
}

/** Provider 挂载 BlockEditor 时共用的 UI / schema 选项（不含 Yjs 或 Hocuspocus）。 */
export type BlockEditorMountOptions = {
  initialContent?: Block[]
  editable: boolean
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
  imageUploadNode?: Node
  canvasBlockNode?: Node
  editorSchema?: EditorSchema
}

/** 纯内存编辑：无 Yjs、无协作。 */
export function createLocalBlockEditor(
  options: BlockEditorMountOptions
): BlockEditor {
  return new BlockEditor({
    initialContent: options.initialContent ?? createStarterBlocks(),
    editable: options.editable,
    editorSchema: options.editorSchema,
    extensions: {
      imageUpload: options.imageUpload,
      canvasImageFetch: options.canvasImageFetch,
      imageUploadNode: options.imageUploadNode,
      canvasBlockNode: options.canvasBlockNode,
    },
  })
}

/** Solo 模式：绑定已有 Y.Doc（REST / AI fork 母本），空文档时写入 initialContent。 */
export function createSoloYjsBlockEditor(
  options: BlockEditorMountOptions & { document: YDoc }
): BlockEditor {
  const wasEmpty = isYjsCollaborationFragmentEmpty(options.document)
  return new BlockEditor({
    initialContent: wasEmpty
      ? (options.initialContent ?? createStarterBlocks())
      : undefined,
    applyInitialContent: wasEmpty,
    editable: options.editable,
    editorSchema: options.editorSchema,
    extensions: {
      document: options.document,
      imageUpload: options.imageUpload,
      canvasImageFetch: options.canvasImageFetch,
      imageUploadNode: options.imageUploadNode,
      canvasBlockNode: options.canvasBlockNode,
    },
  })
}

/** 协作已 synced：Y.Doc + Hocuspocus provider + 当前用户 awareness。 */
export function createCollaborationSyncedBlockEditor(
  options: BlockEditorMountOptions & {
    document: YDoc
    provider: HocuspocusProvider
    user: CollaborationUser
  }
): BlockEditor {
  const wasEmpty = isYjsCollaborationFragmentEmpty(options.document)
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

type RebindVisibleBlockEditorOptions = BlockEditorMountOptions & {
  input: RebindVisibleEditorInput
  /** Solo EditorProvider：改回 shared 时绑定的 Y.Doc。 */
  soloSharedDocument?: YDoc
  /** CollaborationEditorProvider：改回 shared 时的会话三元组。 */
  collaboration?: {
    document: YDoc
    provider: HocuspocusProvider
    user: CollaborationUser
  }
}

/**
 * AI 写作等场景切换「可见」BlockEditor：fork 用独立 Y.Doc，shared 回到会话/母本。
 * 不销毁 Hocuspocus 会话，仅替换 React 层持有的门面实例。
 */
export function createReboundVisibleBlockEditor(
  options: RebindVisibleBlockEditorOptions
): BlockEditor {
  const extensionBase = {
    imageUpload: options.imageUpload,
    canvasImageFetch: options.canvasImageFetch,
    imageUploadNode: options.imageUploadNode,
    canvasBlockNode: options.canvasBlockNode,
  }

  if (options.input.target === "fork") {
    return new BlockEditor({
      applyInitialContent: false,
      editable: options.input.editable,
      editorSchema: options.editorSchema,
      extensions: {
        document: options.input.document,
        ...extensionBase,
      },
    })
  }

  const collab = options.collaboration
  if (collab) {
    return new BlockEditor({
      applyInitialContent: false,
      editable: options.input.editable,
      editorSchema: options.editorSchema,
      extensions: {
        document: collab.document,
        provider: collab.provider,
        user: collab.user,
        ...extensionBase,
      },
    })
  }

  const sharedDocument = options.soloSharedDocument
  if (!sharedDocument) {
    throw new Error(
      "createReboundVisibleBlockEditor: shared target requires soloSharedDocument or collaboration"
    )
  }

  return new BlockEditor({
    applyInitialContent: false,
    editable: options.input.editable,
    editorSchema: options.editorSchema,
    extensions: {
      document: sharedDocument,
      ...extensionBase,
    },
  })
}
