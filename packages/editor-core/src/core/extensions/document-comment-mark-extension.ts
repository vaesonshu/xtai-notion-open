import { Extension } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { BlockEditor } from "../block-editor"
import {
  type DocumentCommentMarkEntry,
  resolveCommentAnchorInDoc,
} from "../document-comment-anchor"

export const documentCommentMarkPluginKey = new PluginKey("documentCommentMark")

export type DocumentCommentMarkState = {
  marks: DocumentCommentMarkEntry[]
  activeCommentId: string | null
}

const EMPTY_STATE: DocumentCommentMarkState = {
  marks: [],
  activeCommentId: null,
}

/** 为评论锚点生成 inline / 块级 PM 装饰 */
function decorationsForState(
  doc: PMNode,
  state: DocumentCommentMarkState
): DecorationSet {
  if (state.marks.length === 0) {
    return DecorationSet.empty
  }

  const decorations: Decoration[] = []
  const blockFallbackIds = new Set<string>()

  for (const mark of state.marks) {
    const isActive = mark.id === state.activeCommentId
    if (mark.anchorFrom != null && mark.anchorTo != null) {
      const range = resolveCommentAnchorInDoc(
        doc,
        mark.blockId,
        mark.anchorFrom,
        mark.anchorTo
      )
      if (!range) continue

      const classes = ["document-comment-inline-mark"]
      if (isActive) {
        classes.push("document-comment-inline-mark-active")
      }
      decorations.push(
        Decoration.inline(range.from, range.to, {
          class: classes.join(" "),
        })
      )
      continue
    }

    blockFallbackIds.add(mark.blockId)
  }

  if (blockFallbackIds.size > 0) {
    doc.descendants((node, pos) => {
      if (node.type.name !== "blockContainer") return
      const id = node.attrs.id as string
      if (!blockFallbackIds.has(id)) return

      const classes = ["document-comment-marked"]
      if (
        state.activeCommentId &&
        state.marks.some(
          (mark) => mark.id === state.activeCommentId && mark.blockId === id
        )
      ) {
        classes.push("document-comment-marked-active")
      }
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: classes.join(" "),
        })
      )
    })
  }

  return DecorationSet.create(doc, decorations)
}

/** 文档选区评论高亮：仅 PM 装饰，不写入 Yjs 块属性 */
export function createDocumentCommentMarkExtension() {
  return Extension.create({
    name: "documentCommentMark",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: documentCommentMarkPluginKey,
          state: {
            init: () => EMPTY_STATE,
            apply(tr, prev: DocumentCommentMarkState) {
              const next = tr.getMeta(documentCommentMarkPluginKey)
              if (next && typeof next === "object" && "marks" in next) {
                return next as DocumentCommentMarkState
              }
              return prev
            },
          },
          props: {
            decorations(state) {
              const markState = documentCommentMarkPluginKey.getState(
                state
              ) as DocumentCommentMarkState | undefined
              if (!markState || markState.marks.length === 0) {
                return DecorationSet.empty
              }
              return decorationsForState(state.doc, markState)
            },
          },
        }),
      ]
    },
  })
}

/** 更新评论装饰集合，触发重算而不改 block attrs */
export function setDocumentCommentMarks(
  editor: BlockEditor,
  marks: readonly DocumentCommentMarkEntry[],
  activeCommentId: string | null = null
): void {
  const next: DocumentCommentMarkState = {
    marks: [...marks],
    activeCommentId,
  }
  editor.tiptap.view.dispatch(
    editor.tiptap.state.tr.setMeta(documentCommentMarkPluginKey, next)
  )
}

/** @deprecated 使用 setDocumentCommentMarks */
export function setDocumentCommentMarkIds(
  editor: BlockEditor,
  commentedIds: Iterable<string>,
  activeId: string | null = null
): void {
  const marks = [...commentedIds].map((blockId) => ({
    id: blockId,
    blockId,
    anchorFrom: null,
    anchorTo: null,
  }))
  setDocumentCommentMarks(editor, marks, activeId)
}
