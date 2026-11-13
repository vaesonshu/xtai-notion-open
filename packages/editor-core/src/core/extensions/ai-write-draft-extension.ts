import { Extension } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { BlockEditor } from "../editor/block-editor"

export const aiWriteDraftPluginKey = new PluginKey("aiWriteDraft")

/** 按块 id 加待确认高亮 class，不写入 Yjs 属性 */
function decorationsForIds(doc: PMNode, ids: Set<string>): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (
      node.type.name === "blockContainer" &&
      ids.has(node.attrs.id as string)
    ) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: "ai-write-draft",
        })
      )
    }
  })
  return DecorationSet.create(doc, decorations)
}

/** 本机 fork 待确认高亮：plugin state 存 id 集合，装饰仅作用于 PM 视图 */
export function createAiWriteDraftExtension() {
  return Extension.create({
    name: "aiWriteDraft",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: aiWriteDraftPluginKey,
          state: {
            init: () => new Set<string>(),
            apply(tr, prev: Set<string>) {
              const next = tr.getMeta(aiWriteDraftPluginKey)
              if (next instanceof Set) {
                return next as Set<string>
              }
              return prev
            },
          },
          props: {
            decorations(state) {
              const ids = aiWriteDraftPluginKey.getState(state) as
                | Set<string>
                | undefined
              if (!ids || ids.size === 0) {
                return DecorationSet.empty
              }
              return decorationsForIds(state.doc, ids)
            },
          },
        }),
      ]
    },
  })
}

/** 用 meta 替换高亮块 id 集合，触发装饰重算而不改 block attrs */
export function setAiWriteDraftIds(
  editor: BlockEditor,
  ids: Iterable<string>
): void {
  editor.tiptap.view.dispatch(
    editor.tiptap.state.tr.setMeta(aiWriteDraftPluginKey, new Set(ids))
  )
}
