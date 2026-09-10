import { Extension } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { BlockEditor } from "../block-editor"
import { resolveCommentAnchorInDoc } from "../document-comment-anchor"

export const documentAgentSelectionPluginKey = new PluginKey(
  "documentAgentSelection"
)

/** 智能体待处理选区：文本 inline 或整块高亮，不写入协作文档。 */
export type DocumentAgentSelectionState =
  | null
  | {
      kind: "text"
      blockId: string
      anchorFrom: number
      anchorTo: number
    }
  | {
      kind: "blocks"
      blockIds: string[]
    }

function decorationsForState(
  doc: PMNode,
  state: DocumentAgentSelectionState
): DecorationSet {
  if (!state) {
    return DecorationSet.empty
  }

  const decorations: Decoration[] = []

  if (state.kind === "text") {
    const range = resolveCommentAnchorInDoc(
      doc,
      state.blockId,
      state.anchorFrom,
      state.anchorTo
    )
    if (range) {
      decorations.push(
        Decoration.inline(range.from, range.to, {
          class: "document-agent-selection-mark",
        })
      )
    }
    return DecorationSet.create(doc, decorations)
  }

  const blockIdSet = new Set(state.blockIds)
  doc.descendants((node, pos) => {
    if (node.type.name !== "blockContainer") return
    const id = node.attrs.id as string
    if (!blockIdSet.has(id)) return

    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: "document-agent-block-mark",
      })
    )
  })

  return DecorationSet.create(doc, decorations)
}

/** 智能体选区高亮插件：标注用户选中的 AI 处理区域。 */
export function createDocumentAgentSelectionExtension() {
  return Extension.create({
    name: "documentAgentSelection",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: documentAgentSelectionPluginKey,
          state: {
            init: (): DocumentAgentSelectionState => null,
            apply(tr, prev: DocumentAgentSelectionState) {
              const next = tr.getMeta(documentAgentSelectionPluginKey)
              if (next !== undefined) {
                return next as DocumentAgentSelectionState
              }
              return prev
            },
          },
          props: {
            decorations(state) {
              const targetState = documentAgentSelectionPluginKey.getState(
                state
              ) as DocumentAgentSelectionState | undefined
              if (!targetState) {
                return DecorationSet.empty
              }
              return decorationsForState(state.doc, targetState)
            },
          },
        }),
      ]
    },
  })
}

/** 更新智能体选区装饰；传 null 清除高亮。 */
export function setDocumentAgentSelectionTarget(
  editor: BlockEditor,
  target: DocumentAgentSelectionState
): void {
  editor.tiptap.view.dispatch(
    editor.tiptap.state.tr.setMeta(documentAgentSelectionPluginKey, target)
  )
}
