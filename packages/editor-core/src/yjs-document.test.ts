import { describe, expect, it } from "vitest"
import { TiptapTransformer } from "@hocuspocus/transformer"
import { Editor } from "@tiptap/core"
import { blocksToPmDoc } from "./block-schema/convert"
import { createStarterBlocks } from "./block-schema/documents"
import { createEditorExtensions } from "./extensions"
import { documentFromYjs, documentToPlainText } from "./yjs-document"

describe("yjs-document", () => {
  it("round-trips starter content through Yjs into Block[]", () => {
    const extensions = createEditorExtensions()
    const editor = new Editor({ extensions })
    const starterJson = blocksToPmDoc(
      createStarterBlocks(),
      editor.schema
    ).toJSON()
    editor.destroy()

    const yDoc = TiptapTransformer.extensions(extensions).toYdoc(
      starterJson,
      "default"
    )

    const restored = documentFromYjs(yDoc)
    yDoc.destroy()

    expect(restored.length).toBeGreaterThan(0)
    expect(restored[0]?.type).toBe("heading")
    expect(documentToPlainText(restored)).toContain("让知识真正流动起来")
  })
})
