import { Extension, InputRule, textblockTypeInputRule } from "@tiptap/core"
import type { NodeType } from "@tiptap/pm/model"

function requireNode(
  nodes: Record<string, NodeType | undefined>,
  name: string
) {
  const type = nodes[name]
  if (!type) {
    throw new Error(`Missing block node for markdown shortcut: ${name}`)
  }
  return type
}

/** 行首 Markdown 快捷键：把当前 blockContent 转成对应块类型 */
export const MarkdownInputRules = Extension.create({
  name: "markdownInputRules",

  addInputRules() {
    const nodes = this.editor.schema.nodes
    const heading = requireNode(nodes, "heading")
    const bullet = requireNode(nodes, "bulletListItem")
    const numbered = requireNode(nodes, "numberedListItem")
    const check = requireNode(nodes, "checkListItem")
    const quote = requireNode(nodes, "quote")
    const code = requireNode(nodes, "codeBlock")
    const divider = requireNode(nodes, "divider")

    return [
      textblockTypeInputRule({
        find: /^-\s\[([ xX])\]\s$/,
        type: check,
        getAttributes: (match) => ({
          checked: String(match[1]).toLowerCase() === "x",
        }),
      }),
      textblockTypeInputRule({
        find: /^(#{1,3})\s$/,
        type: heading,
        getAttributes: (match) => ({
          level: match[1]?.length ?? 1,
        }),
      }),
      textblockTypeInputRule({
        find: /^\d+\.\s$/,
        type: numbered,
      }),
      textblockTypeInputRule({
        find: /^[-*]\s$/,
        type: bullet,
      }),
      textblockTypeInputRule({
        find: /^>\s$/,
        type: quote,
      }),
      textblockTypeInputRule({
        find: /^```$/,
        type: code,
      }),
      new InputRule({
        find: /^---\s$/,
        handler: ({ chain, state, range }) => {
          const $from = state.doc.resolve(range.from)
          let contentDepth = $from.depth
          while (contentDepth > 0) {
            const node = $from.node(contentDepth)
            if (node.type.isBlock && node.type.name !== "blockContainer") {
              break
            }
            contentDepth -= 1
          }
          if (contentDepth === 0) {
            return null
          }
          const from = $from.before(contentDepth)
          const to = $from.after(contentDepth)
          chain()
            .command(({ tr }) => {
              tr.replaceWith(from, to, divider.create())
              return true
            })
            .run()
        },
      }),
    ]
  },
})
