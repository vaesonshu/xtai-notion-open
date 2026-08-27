import { TiptapTransformer } from "@hocuspocus/transformer"
import { describe, expect, it } from "vitest"
import { collectMentionIds } from "./mention-collect"
import { createEditorExtensions } from "./extensions"
import { documentFromYjs } from "./yjs-document"

describe("mention yjs roundtrip", () => {
  it("preserves mention id through Yjs for graph extraction", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: {
                id: "doc-target",
                label: "Target",
                href: "/documents/doc-target",
              },
            },
          ],
        },
      ],
    }

    const yDoc = TiptapTransformer.extensions(
      createEditorExtensions()
    ).toYdoc(content, "default")
    const restored = documentFromYjs(yDoc)
    yDoc.destroy()

    expect(collectMentionIds(restored)).toEqual(["doc-target"])
  })
})
