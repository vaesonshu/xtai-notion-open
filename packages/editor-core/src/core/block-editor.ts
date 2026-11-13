import { Editor } from "@tiptap/core"
import { blocksToPmDoc, pmDocToBlocks } from "./block-schema/convert"
import { createEmptyBlocks } from "./block-schema/documents"
import type { Block, PartialBlock } from "./block-schema/types"
import {
  BLOCK_SIDE_MENU_PLUGIN_KEY,
  createBlockSideMenuController,
} from "./block-side-menu"
import {
  createBlockSchemaExtensions,
  createBlockSchemaExtensionsFromRegistry,
} from "./extensions"
import { handleBackspace } from "./extensions/block-keymap"
import type { EditorSchema } from "./schema/create-editor-schema"
import type { EditorExtensionOptions } from "./types"
import { getCommentTextSelection as resolveCommentTextSelection } from "./document-comment-anchor"
import type { CommentTextAnchor } from "./document-comment-anchor"
import { insertBlocks as apiInsertBlocks } from "./api/blockManipulation/commands/insertBlocks"
import { updateBlock as apiUpdateBlock } from "./api/blockManipulation/commands/updateBlock"
import { removeBlocks as apiRemoveBlocks } from "./api/blockManipulation/commands/removeBlocks"
import { nestBlock as apiNestBlock } from "./api/blockManipulation/commands/nestBlock"
import { unnestBlock as apiUnnestBlock } from "./api/blockManipulation/commands/unnestBlock"
import { getSelectedBlocks as apiGetSelectedBlocks } from "./api/blockManipulation/selections/getSelectedBlocks"
import { getActiveBlockContainerId as apiGetActiveBlockContainerId } from "./api/blockManipulation/selections/getActiveBlockContainerId"
import { handleTableBlockPaste } from "./api/clipboard/fromClipboard/tableBlockPaste"
import { handleMarkdownPaste } from "./api/clipboard/fromClipboard/handleMarkdownPaste"

type BlockEditorOptions = {
  initialContent?: Block[]
  editable?: boolean
  extensions?: EditorExtensionOptions
  /** SDK 自定义块 schema；传入时优先于默认 createEditorSchema() */
  editorSchema?: EditorSchema
  /** 协作模式下远端已有内容时应为 false，避免覆盖 Y.Doc */
  applyInitialContent?: boolean
}

/**
 * 块文档门面：对外暴露 Block[] 与块级命令，内部持有 Tiptap/PM 实例。
 * 块操纵实现位于 `core/api`，本类仅做装配与委托。
 * tiptap getter 仅供 React NodeView / 协作层内部使用。
 */
export class BlockEditor {
  private readonly editor: Editor
  private readonly sideMenuController: ReturnType<
    typeof createBlockSideMenuController
  >

  constructor(options: BlockEditorOptions = {}) {
    const extensionOptions = options.extensions ?? {}
    this.editor = new Editor({
      extensions: options.editorSchema
        ? createBlockSchemaExtensionsFromRegistry(
            extensionOptions,
            options.editorSchema.registry
          )
        : createBlockSchemaExtensions(extensionOptions),
      editable: options.editable ?? true,
      editorProps: {
        handleKeyDown: (view, event) => {
          if (
            event.key === "Backspace" &&
            !event.altKey &&
            !event.metaKey &&
            !event.ctrlKey
          ) {
            const handled = handleBackspace(view.state, view.dispatch)
            if (handled) {
              event.preventDefault()
              this.editor.commands.focus()
              return true
            }
          }

          if (
            event.key === "Tab" &&
            !event.altKey &&
            !event.metaKey &&
            !event.ctrlKey
          ) {
            event.preventDefault()
            if (event.shiftKey) {
              this.unnestBlock()
            } else {
              this.nestBlock()
            }
            return true
          }
          return false
        },
        // 表格单元格内粘贴块 JSON 时压成纯文本，避免嵌套块结构
        handlePaste: (view, event) => {
          if (handleTableBlockPaste(view, event)) {
            return true
          }
          return handleMarkdownPaste(this.editor, event)
        },
      },
      // Next.js 需显式关闭首帧渲染，避免 SSR/水合与软导航后正文空白
      immediatelyRender: false,
    } as ConstructorParameters<typeof Editor>[0])

    this.sideMenuController = createBlockSideMenuController(this.editor)
    this.editor.registerPlugin(this.sideMenuController.plugin)

    if (options.applyInitialContent !== false) {
      const initialBlocks = options.initialContent ?? createEmptyBlocks()
      const doc = blocksToPmDoc(initialBlocks, this.editor.schema)
      this.editor.commands.setContent(doc.toJSON())
    }
  }

  get document(): Block[] {
    return pmDocToBlocks(this.editor.state.doc)
  }

  /** @internal React NodeView / 协作绑定使用，不从包根导出 */
  get tiptap(): Editor {
    return this.editor
  }

  /** 块侧栏菜单：悬停定位与拖拽冻结控制 */
  readonly sideMenu = {
    subscribe: (
      listener: Parameters<
        ReturnType<typeof createBlockSideMenuController>["subscribe"]
      >[0]
    ) => this.sideMenuController.subscribe(listener),
    freezeMenu: () => this.sideMenuController.freezeMenu(),
    unfreezeMenu: () => this.sideMenuController.unfreezeMenu(),
  }

  insertBlocks(
    blocks: PartialBlock[],
    refId: string,
    placement: "before" | "after" | "nested"
  ): void {
    apiInsertBlocks(this.editor, blocks, refId, placement)
  }

  updateBlock(
    id: string,
    update: {
      type?: Block["type"]
      props?: Record<string, unknown>
      content?: Block["content"]
    }
  ): void {
    apiUpdateBlock(this.editor, id, update)
  }

  removeBlocks(ids: string[]): void {
    apiRemoveBlocks(this.editor, ids)
  }

  nestBlock(): boolean {
    return apiNestBlock(this.editor)
  }

  unnestBlock(): boolean {
    return apiUnnestBlock(this.editor)
  }

  getSelectedBlocks(): Block[] {
    return apiGetSelectedBlocks(this.editor)
  }

  /** 解析当前选区所在的 blockContainer id（折叠光标也可用） */
  getActiveBlockContainerId(): string | null {
    return apiGetActiveBlockContainerId(this.editor)
  }

  /** 非空文本选区且落在单块内时返回评论锚点 */
  getCommentTextSelection(): CommentTextAnchor | null {
    return resolveCommentTextSelection(this)
  }

  onChange(listener: (blocks: Block[]) => void): () => void {
    const handler = () => {
      listener(this.document)
    }
    this.editor.on("update", handler)
    return () => {
      this.editor.off("update", handler)
    }
  }

  setEditable(editable: boolean): void {
    this.editor.setEditable(editable)
  }

  destroy(): void {
    if (!this.editor.isDestroyed) {
      this.editor.unregisterPlugin(BLOCK_SIDE_MENU_PLUGIN_KEY)
    }
    this.editor.destroy()
  }
}
