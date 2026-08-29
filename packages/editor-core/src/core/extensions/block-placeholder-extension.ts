import { Extension, isNodeEmpty } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { EditorExtensionOptions } from "../types"
import {
  DEFAULT_PARAGRAPH_PLACEHOLDER,
  resolveBlockPlaceholder,
} from "./block-placeholder"

export const blockPlaceholderPluginKey = new PluginKey("blockPlaceholder")

/** 从当前选区向上找到第一个空的 textblock（适配 blockContainer 嵌套） */
function findEmptyTextblockAtSelection(state: {
  selection: { empty: boolean; $from: { depth: number; before: (d: number) => number; node: (d: number) => import("@tiptap/pm/model").Node } }
}) {
  if (!state.selection.empty) {
    return null
  }

  const { $from } = state.selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.isTextblock && isNodeEmpty(node)) {
      return { node, pos: $from.before(depth) }
    }
  }

  return null
}

/** 块模型专用 Placeholder：装饰当前光标所在的空 textblock */
export function createBlockPlaceholderExtension(
  options: Pick<EditorExtensionOptions, "placeholder"> = {}
) {
  const paragraphHint = options.placeholder ?? DEFAULT_PARAGRAPH_PLACEHOLDER

  return Extension.create({
    name: "placeholder",
    addProseMirrorPlugins() {
      const editor = this.editor

      return [
        new Plugin({
          key: blockPlaceholderPluginKey,
          props: {
            decorations(state) {
              if (!editor.isEditable) {
                return DecorationSet.empty
              }

              const target = findEmptyTextblockAtSelection(state)
              if (!target) {
                return DecorationSet.empty
              }

              const { node, pos } = target
              const classes = ["is-empty"]
              if (editor.isEmpty) {
                classes.push("is-editor-empty")
              }

              return DecorationSet.create(state.doc, [
                Decoration.node(pos, pos + node.nodeSize, {
                  class: classes.join(" "),
                  "data-placeholder": resolveBlockPlaceholder(
                    { editor, node, pos },
                    paragraphHint
                  ),
                }),
              ])
            },
          },
        }),
      ]
    },
  })
}
