import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/block-editor"
import {
  getCommentTextSelection,
  getBlockTextContentRange,
  resolveCommentAnchorInDoc,
} from "@core/document-comment-anchor"
import {
  documentCommentMarkPluginKey,
  setDocumentCommentMarks,
} from "@core/extensions/document-comment-mark-extension"

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const editors: BlockEditor[] = []

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("document comment selection anchor", () => {
  it("returns anchor for non-empty text selection within one block", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: ID,
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "hello world", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)

    editor.tiptap.commands.setTextSelection({ from: 2, to: 7 })

    const anchor = getCommentTextSelection(editor)
    expect(anchor?.blockId).toBe(ID)
    expect(anchor?.preview).toBe("hell")
    expect(anchor?.anchorFrom).toBe(0)
    expect(anchor?.anchorTo).toBe(4)
  })

  it("returns null for collapsed cursor", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: ID,
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "hello", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)

    expect(getCommentTextSelection(editor)).toBeNull()
  })
})

describe("document comment mark decorations", () => {
  it("marks selected range with document-comment-inline-mark class", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: ID,
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "commented text", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)

    const contentRange = getBlockTextContentRange(editor.tiptap.state.doc, ID)
    expect(contentRange).not.toBeNull()

    setDocumentCommentMarks(editor, [
      {
        id: "comment-1",
        blockId: ID,
        anchorFrom: 0,
        anchorTo: 9,
      },
    ])

    const resolved = resolveCommentAnchorInDoc(
      editor.tiptap.state.doc,
      ID,
      0,
      9
    )
    expect(resolved).not.toBeNull()

    const span = editor.tiptap.view.dom.querySelector(
      ".document-comment-inline-mark"
    )
    expect(span).toBeTruthy()
    expect(documentCommentMarkPluginKey).toBeDefined()
  })
})
