import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/editor/block-editor"
import { getBlockTextContentRange } from "@core/document-comment-anchor"
import {
  documentAgentSelectionPluginKey,
  setDocumentAgentSelectionTarget,
} from "@core/extensions/document-agent-selection-extension"

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const editors: BlockEditor[] = []

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("document agent selection decorations", () => {
  it("marks selected text range with document-agent-selection-mark class", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: ID,
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "agent target text", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)

    const contentRange = getBlockTextContentRange(editor.tiptap.state.doc, ID)
    expect(contentRange).not.toBeNull()

    setDocumentAgentSelectionTarget(editor, {
      kind: "text",
      blockId: ID,
      anchorFrom: 0,
      anchorTo: 6,
    })

    const span = editor.tiptap.view.dom.querySelector(
      ".document-agent-selection-mark"
    )
    expect(span).toBeTruthy()
    expect(documentAgentSelectionPluginKey).toBeDefined()
  })

  it("clears highlight when target is set to null", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: ID,
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "clear me", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)

    setDocumentAgentSelectionTarget(editor, {
      kind: "text",
      blockId: ID,
      anchorFrom: 0,
      anchorTo: 4,
    })
    expect(
      editor.tiptap.view.dom.querySelector(".document-agent-selection-mark")
    ).toBeTruthy()

    setDocumentAgentSelectionTarget(editor, null)
    expect(
      editor.tiptap.view.dom.querySelector(".document-agent-selection-mark")
    ).toBeNull()
  })
})
