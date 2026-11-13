import { describe, expect, it } from "vitest"
import { BlockEditor } from "@core/editor/block-editor"
import { getActiveBlockToolbarCommand } from "@core/block-toolbar"

describe("getActiveBlockToolbarCommand", () => {
  it("detects the heading level at the cursor", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "heading",
          props: { level: 1 },
          content: [{ type: "text", text: "Title", styles: {} }],
          children: [],
        },
      ],
    })

    editor.tiptap.commands.setTextSelection(3)

    expect(
      getActiveBlockToolbarCommand(editor.tiptap.state)
    ).toBe("heading-1")

    editor.destroy()
  })
})
