import { Editor } from "@tiptap/core"
import { afterEach, describe, expect, it } from "vitest"
import { createBlockSchemaExtensions } from "@core/extensions"
import { blocksToPmDoc, pmDocToBlocks } from "@core/block-schema/convert"

const editors: Editor[] = []

afterEach(() => {
  for (const editor of editors) {
    editor.destroy()
  }
  editors.length = 0
})

describe("inline color roundtrip", () => {
  it("preserves text color when converting blocks to PM and back", () => {
    const blocks = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        type: "paragraph" as const,
        props: {},
        content: [
          {
            type: "text" as const,
            text: "colored",
            styles: { color: "#24866B" },
          },
        ],
        children: [],
      },
    ]

    const editor = new Editor({
      extensions: createBlockSchemaExtensions(),
      content: undefined,
    })
    editors.push(editor)

    const doc = blocksToPmDoc(blocks, editor.schema)
    editor.commands.setContent(doc.toJSON())

    expect(pmDocToBlocks(editor.state.doc)[0]?.content).toEqual(blocks[0]?.content)
  })
})
