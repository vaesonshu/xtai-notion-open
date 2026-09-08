import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import type { JSONContent } from "@tiptap/core"
import { blocksToPmDoc } from "@xtai-notion/editor-core/block-schema/convert"
import { createEmptyBlocks } from "@xtai-notion/editor-core/block-schema/documents"
import { createEditorExtensions } from "@xtai-notion/editor-core/extensions"
import {
  applyLinkAtRange,
  captureLinkMarkRange,
} from "@shadcn-src/components/editor/capture-link-range"

const editors: Editor[] = []

function createLinkedEditor(): Editor {
  const extensions = createEditorExtensions()
  const schema = new Editor({ extensions }).schema
  const editor = new Editor({
    extensions,
    content: blocksToPmDoc(
      [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "paragraph",
          props: {},
          content: [
            {
              type: "link",
              href: "https://example.com/old",
              content: [{ type: "text", text: "Example link", styles: {} }],
            },
          ],
          children: [],
        },
      ],
      schema
    ).toJSON() as JSONContent,
  })

  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) {
    editor.destroy()
  }
  editors.length = 0
  document.body.innerHTML = ""
})

describe("applyLinkAtRange", () => {
  it("updates the href on the stored link range", () => {
    const editor = createLinkedEditor()
    document.body.appendChild(editor.view.dom)

    const anchor = editor.view.dom.querySelector("a.editor-inline-link")
    expect(anchor).toBeTruthy()

    const range = captureLinkMarkRange(editor, anchor as HTMLAnchorElement)
    expect(range).toEqual(expect.objectContaining({ from: expect.any(Number) }))

    expect(applyLinkAtRange(editor, range, "https://example.com/new")).toBe(
      true
    )
    expect(
      editor.isActive("link", { href: "https://example.com/new" })
    ).toBe(true)
  })

  it("returns false when range is missing", () => {
    const editor = createLinkedEditor()
    expect(applyLinkAtRange(editor, undefined, "https://example.com")).toBe(
      false
    )
  })
})
