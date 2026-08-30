import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/block-editor"
import {
  aiWriteAgentCursorPluginKey,
  setAiWriteAgentCursor,
} from "@core/extensions/ai-write-agent-cursor-extension"

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const editors: BlockEditor[] = []

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("ai-write-agent-cursor", () => {
  it("renders AI agent cursor widget at block content end", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: ID,
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "hi", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)

    setAiWriteAgentCursor(editor, ID)

    const widget = editor.tiptap.view.dom.querySelector(
      ".ai-write-agent-cursor__label"
    )
    expect(widget?.textContent).toBe("AI")
    expect(aiWriteAgentCursorPluginKey.getState(editor.tiptap.state)).toBe(ID)
  })

  it("clears agent cursor when block id is null", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: ID,
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "hi", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)

    setAiWriteAgentCursor(editor, ID)
    setAiWriteAgentCursor(editor, null)

    expect(
      editor.tiptap.view.dom.querySelector(".ai-write-agent-cursor")
    ).toBeNull()
  })
})
