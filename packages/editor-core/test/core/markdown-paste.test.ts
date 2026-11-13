import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/editor/block-editor"
import { handleMarkdownPaste } from "@core/api/clipboard/fromClipboard/handleMarkdownPaste"

const EMPTY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const CODE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

const editors: BlockEditor[] = []

function track(editor: BlockEditor) {
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

function pasteEvent(plain: string, html = ""): ClipboardEvent {
  return {
    clipboardData: {
      getData: (type: string) => {
        if (type === "text/plain") return plain
        if (type === "text/html") return html
        return ""
      },
    },
  } as ClipboardEvent
}

describe("handleMarkdownPaste", () => {
  it("converts markdown plain text on an empty paragraph", () => {
    const editor = track(
      new BlockEditor({
        initialContent: [
          {
            id: EMPTY_ID,
            type: "paragraph",
            props: {},
            content: [],
            children: [],
          },
        ],
      })
    )

    const handled = handleMarkdownPaste(
      editor.tiptap,
      pasteEvent("# Hello\n\n- item one")
    )
    expect(handled).toBe(true)
    expect(editor.document[0]?.type).toBe("heading")
    expect(editor.document[1]?.type).toBe("bulletListItem")
  })

  it("still converts markdown when clipboard also includes list html", () => {
    const editor = track(
      new BlockEditor({
        initialContent: [
          {
            id: EMPTY_ID,
            type: "paragraph",
            props: {},
            content: [],
            children: [],
          },
        ],
      })
    )

    const handled = handleMarkdownPaste(
      editor.tiptap,
      pasteEvent("- item one", "<ul><li>item one</li></ul>")
    )
    expect(handled).toBe(true)
    expect(editor.document[0]?.type).toBe("bulletListItem")
  })

  it("converts full markdown document even with preview html on clipboard", () => {
    const editor = track(
      new BlockEditor({
        initialContent: [
          {
            id: EMPTY_ID,
            type: "paragraph",
            props: {},
            content: [],
            children: [],
          },
        ],
      })
    )

    const markdown = [
      "# 让知识真正流动起来",
      "",
      "这是一个可编辑的知识文档。",
      "",
      "- 记录想法",
      "",
      "> 好的工具让秩序自然出现。",
      "",
      "```",
      "const knowledge = true",
      "```",
    ].join("\n")
    const html =
      "<ul><li>记录想法</li></ul><blockquote>好的工具让秩序自然出现。</blockquote>"

    const handled = handleMarkdownPaste(
      editor.tiptap,
      pasteEvent(markdown, html)
    )
    expect(handled).toBe(true)
    expect(editor.document.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "bulletListItem",
      "quote",
      "codeBlock",
    ])
  })

  it("does not convert inside a code block", () => {
    const editor = track(
      new BlockEditor({
        initialContent: [
          {
            id: CODE_ID,
            type: "codeBlock",
            props: { language: "" },
            content: [{ type: "text", text: "const x = 1", styles: {} }],
            children: [],
          },
        ],
      })
    )

    editor.tiptap.commands.focus("end")
    const handled = handleMarkdownPaste(editor.tiptap, pasteEvent("# Hello"))
    expect(handled).toBe(false)
    expect(editor.document[0]?.type).toBe("codeBlock")
  })
})
