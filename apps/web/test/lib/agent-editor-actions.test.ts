import { BlockEditor } from "@xtai-notion/editor-core"
import { describe, expect, it, afterEach } from "vitest"
import {
  applyAgentMarkdownToEditor,
  buildDocumentAgentContext,
  canReplaceEditorTarget,
  type AgentEditorTarget,
} from "@/lib/agent-editor-actions"

const editors: BlockEditor[] = []

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

function createEditor() {
  const editor = new BlockEditor({
    initialContent: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "one", styles: {} }],
        children: [],
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "two", styles: {} }],
        children: [],
      },
    ],
  })
  editors.push(editor)
  return editor
}

describe("agent editor actions", () => {
  it("builds replace prompt for text selection", () => {
    const target: AgentEditorTarget = {
      kind: "text",
      anchor: {
        blockId: "b1",
        anchorFrom: 0,
        anchorTo: 4,
        preview: "选中片段",
      },
    }
    const context = buildDocumentAgentContext("全文内容", target, "replace")
    expect(context).toContain("【选中片段】")
    expect(context).toContain("选中片段")
    expect(context).toContain("只输出用于替换选中片段的内容")
  })

  it("allows replace only when text or blocks are selected", () => {
    expect(
      canReplaceEditorTarget({
        kind: "text",
        anchor: {
          blockId: "b1",
          anchorFrom: 0,
          anchorTo: 1,
          preview: "a",
        },
      })
    ).toBe(true)
    expect(canReplaceEditorTarget({ kind: "cursor", blockId: "b1" })).toBe(
      false
    )
  })

  it("inserts multi-block markdown after the active block without range errors", () => {
    const editor = createEditor()
    editor.tiptap.commands.setTextSelection(3)

    const result = applyAgentMarkdownToEditor(
      editor,
      "# 标题\n\n第二段内容",
      "insert"
    )

    expect(result.ok).toBe(true)
    expect(editor.document.length).toBeGreaterThan(2)
    expect(editor.document.some((block) => block.type === "heading")).toBe(true)
  })
})
