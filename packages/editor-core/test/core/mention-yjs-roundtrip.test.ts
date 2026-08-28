import { TiptapTransformer } from "@hocuspocus/transformer"
import { Editor } from "@tiptap/core"
import { describe, expect, it } from "vitest"
import { blocksToPmDoc } from "@core/block-schema/convert"
import type { Block } from "@core/block-schema/types"
import { createEditorExtensions } from "@core/extensions"
import { collectMentionIds } from "@core/mention-collect"
import { documentFromYjs } from "@core/yjs-document"

describe("mention yjs roundtrip", () => {
  it("preserves mention id through Yjs for graph extraction", () => {
    const blocks: Block[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        type: "paragraph",
        props: {},
        content: [
          {
            type: "mention",
            id: "doc-target",
            label: "Target",
            href: "/documents/doc-target",
          },
        ],
        children: [],
      },
    ]

    const extensions = createEditorExtensions()
    const editor = new Editor({ extensions })
    const json = blocksToPmDoc(blocks, editor.schema).toJSON()
    editor.destroy()

    const yDoc = TiptapTransformer.extensions(extensions).toYdoc(
      json,
      "default"
    )
    const restored = documentFromYjs(yDoc)
    yDoc.destroy()

    expect(collectMentionIds(restored)).toEqual(["doc-target"])
  })
})
