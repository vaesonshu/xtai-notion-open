import { describe, expect, it } from "vitest"
import { TiptapTransformer } from "@hocuspocus/transformer"
import { Editor } from "@tiptap/core"
import * as Y from "yjs"
import { blocksToPmDoc } from "@core/block-schema/convert"
import { createStarterBlocks } from "@core/block-schema/documents"
import { generateBlockId } from "@core/block-schema/ids"
import { createEditorExtensions } from "@core/extensions"
import {
  appendTextToBlockSchemaYDoc,
  createBlockSchemaYDoc,
  documentFromYjs,
  documentToPlainText,
} from "@core/yjs-document"

describe("yjs-document", () => {
  it("creates and reads block schema Y.Doc without Tiptap Editor", () => {
    const doc = createBlockSchemaYDoc([
      {
        id: generateBlockId(),
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "Hello", styles: {} }],
        children: [],
      },
    ])

    expect(documentToPlainText(documentFromYjs(doc))).toBe("Hello")

    appendTextToBlockSchemaYDoc(doc, " world")
    expect(documentToPlainText(documentFromYjs(doc))).toBe("Hello world")

    doc.destroy()
  })

  it("syncs appended text to a cloned Y.Doc via Yjs updates", () => {
    const a = createBlockSchemaYDoc([
      {
        id: generateBlockId(),
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "Hello", styles: {} }],
        children: [],
      },
    ])
    const b = new Y.Doc()
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))

    appendTextToBlockSchemaYDoc(a, " world")
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)))

    expect(documentToPlainText(documentFromYjs(b))).toBe("Hello world")
    a.destroy()
    b.destroy()
  })

  it("syncs appended text after two independently created docs merge", () => {
    const a = createBlockSchemaYDoc()
    const b = createBlockSchemaYDoc()
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)))
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)))

    appendTextToBlockSchemaYDoc(a, "pair-sync")
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)))

    expect(documentToPlainText(documentFromYjs(b))).toContain("pair-sync")
    a.destroy()
    b.destroy()
  })

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
