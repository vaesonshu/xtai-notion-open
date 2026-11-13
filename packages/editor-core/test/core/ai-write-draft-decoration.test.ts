import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/editor/block-editor"
import {
  aiWriteDraftPluginKey,
  setAiWriteDraftIds,
} from "@core/extensions/ai-write-draft-extension"

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const editors: BlockEditor[] = []

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("ai write draft decorations", () => {
  it("marks matching blockContainer with ai-write-draft class", () => {
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

    setAiWriteDraftIds(editor, [ID])

    const container = editor.tiptap.view.dom.querySelector("[data-id]")
    expect(container?.className).toContain("ai-write-draft")
    expect(aiWriteDraftPluginKey).toBeDefined()
  })
})
