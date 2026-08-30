import { Extension } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { BlockEditor } from "../block-editor"

export const aiWriteAgentCursorPluginKey = new PluginKey("aiWriteAgentCursor")

const AGENT_CURSOR_COLOR = "#8bc6ff"
const AGENT_CURSOR_LABEL = "AI"

/** 定位块内容区末尾，供 AI 代理光标 widget 锚定 */
function findBlockContentEnd(doc: PMNode, blockId: string): number | null {
  let result: number | null = null
  doc.descendants((node, pos) => {
    if (result !== null) {
      return false
    }
    if (node.type.name === "blockContainer" && node.attrs.id === blockId) {
      const content = node.firstChild
      if (content?.isTextblock) {
        result = pos + 1 + content.nodeSize - 1
      }
      return false
    }
    return undefined
  })
  return result
}

/** 参考 BlockNote AgentCursor：协作光标样式的本机 AI 写入指示器 */
function renderAgentCursor(): HTMLElement {
  const root = document.createElement("span")
  root.className = "ai-write-agent-cursor"
  root.setAttribute("contenteditable", "false")

  const caret = document.createElement("span")
  caret.className = "ai-write-agent-cursor__caret"
  caret.style.backgroundColor = AGENT_CURSOR_COLOR

  const label = document.createElement("span")
  label.className = "ai-write-agent-cursor__label"
  label.style.backgroundColor = AGENT_CURSOR_COLOR
  label.textContent = AGENT_CURSOR_LABEL

  caret.appendChild(label)
  root.appendChild(caret)
  return root
}

/** fork 编辑器上的本机 AI 光标，不接入 Hocuspocus awareness */
export function createAiWriteAgentCursorExtension() {
  return Extension.create({
    name: "aiWriteAgentCursor",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: aiWriteAgentCursorPluginKey,
          state: {
            init: (): string | null => null,
            apply(tr, blockId: string | null) {
              const next = tr.getMeta(aiWriteAgentCursorPluginKey)
              if (next === null || typeof next === "string") {
                return next as string | null
              }
              return blockId
            },
          },
          props: {
            decorations(state) {
              const blockId = aiWriteAgentCursorPluginKey.getState(state) as
                | string
                | null
                | undefined
              if (!blockId) {
                return DecorationSet.empty
              }
              const head = findBlockContentEnd(state.doc, blockId)
              if (head === null) {
                return DecorationSet.empty
              }
              return DecorationSet.create(state.doc, [
                Decoration.widget(head, renderAgentCursor, {
                  key: "ai-write-agent-cursor",
                  side: 1,
                }),
              ])
            },
          },
        }),
      ]
    },
  })
}

/** 设置 AI 代理光标锚定块；传 null 清除 */
export function setAiWriteAgentCursor(
  editor: BlockEditor,
  blockId: string | null
): void {
  editor.tiptap.view.dispatch(
    editor.tiptap.state.tr.setMeta(aiWriteAgentCursorPluginKey, blockId)
  )
}
