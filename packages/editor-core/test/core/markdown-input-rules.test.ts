import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/editor/block-editor"
import { createEmptyBlocks } from "@core/model/documents"

const editors: BlockEditor[] = []

function track(editor: BlockEditor) {
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

/** InputRules 走 handleTextInput；insertContent 不会触发它们 */
function typeText(editor: BlockEditor, text: string) {
  const view = editor.tiptap.view
  for (const character of text) {
    const { from, to } = view.state.selection
    const handled = view.someProp("handleTextInput", (handler) =>
      handler(view, from, to, character) ? true : null
    )
    if (!handled) {
      view.dispatch(view.state.tr.insertText(character, from, to))
    }
  }
}

describe("markdown input rules", () => {
  it("turns # space into a heading", () => {
    const editor = track(
      new BlockEditor({ initialContent: createEmptyBlocks() })
    )
    editor.tiptap.commands.focus("start")
    typeText(editor, "# ")
    expect(editor.document[0]?.type).toBe("heading")
    expect(editor.document[0]?.props.level).toBe(1)
  })

  it("turns - space into a bullet list item", () => {
    const editor = track(
      new BlockEditor({ initialContent: createEmptyBlocks() })
    )
    editor.tiptap.commands.focus("start")
    typeText(editor, "- ")
    expect(editor.document[0]?.type).toBe("bulletListItem")
  })

  it("applies bold from markdown asterisks", () => {
    const editor = track(
      new BlockEditor({ initialContent: createEmptyBlocks() })
    )
    editor.tiptap.commands.focus("start")
    typeText(editor, "**hi**")
    const content = editor.document[0]?.content
    const texts = Array.isArray(content)
      ? content.filter(
          (
            item
          ): item is {
            type: "text"
            text: string
            styles: { bold?: boolean }
          } => item.type === "text"
        )
      : []
    expect(texts.some((item) => item.text === "hi" && item.styles.bold)).toBe(
      true
    )
  })

  it("does not convert markdown prefixes inside a code block", () => {
    const editor = track(
      new BlockEditor({
        initialContent: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            type: "codeBlock",
            props: { language: "" },
            content: [{ type: "text", text: "keep", styles: {} }],
            children: [],
          },
        ],
      })
    )
    editor.tiptap.commands.focus("start")
    typeText(editor, "# ")
    expect(editor.document[0]?.type).toBe("codeBlock")
  })
})
