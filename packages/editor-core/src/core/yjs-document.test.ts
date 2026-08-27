import { describe, expect, it } from "vitest"
import { TiptapTransformer } from "@hocuspocus/transformer"
import { createEditorExtensions } from "./extensions"
import { createStarterDocument } from "./document"
import { documentFromYjs, documentToPlainText } from "./yjs-document"

describe("yjs-document", () => {
  it("round-trips starter content through Yjs into TipTap JSON", () => {
    const starter = createStarterDocument()
    const yDoc = TiptapTransformer.extensions(
      createEditorExtensions()
    ).toYdoc(starter, "default")

    const restored = documentFromYjs(yDoc)
    yDoc.destroy()

    expect(restored.type).toBe("doc")
    expect(restored.content.length).toBeGreaterThan(0)
    expect(documentToPlainText(restored)).toContain("让知识真正流动起来")
  })
})
