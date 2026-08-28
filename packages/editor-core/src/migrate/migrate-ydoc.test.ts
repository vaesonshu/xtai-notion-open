import { TiptapTransformer } from "@hocuspocus/transformer"
import * as Y from "yjs"
import { describe, expect, it } from "vitest"
import { collectMentionIds } from "../mention-collect"
import { documentFromYjs } from "../yjs-document"
import { createLegacyEditorExtensions } from "./legacy-extensions"
import {
  migrateV1YDocToV2,
  readYDocSchemaVersion,
  writeYDocSchemaVersion,
} from "./migrate-ydoc"

/** 用旧 StarterKit 扩展写入 v1 协作快照 fixture */
function createLegacyV1Doc(): Y.Doc {
  const legacyExtensions = createLegacyEditorExtensions()
  const legacyJson = {
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
  const doc = TiptapTransformer.extensions(legacyExtensions).toYdoc(
    legacyJson,
    "default",
    legacyExtensions
  )
  writeYDocSchemaVersion(doc, 1)
  return doc
}

describe("migrate-ydoc", () => {
  it("migrates legacy paragraph+mention to block schema v2", () => {
    const v1Doc = createLegacyV1Doc()
    const migrated = migrateV1YDocToV2(v1Doc)

    expect(readYDocSchemaVersion(v1Doc)).toBe(1)
    expect(readYDocSchemaVersion(migrated)).toBe(2)

    const blocks = documentFromYjs(migrated)
    expect(blocks[0]?.type).toBe("paragraph")
    expect(collectMentionIds(blocks)).toEqual(["doc-target"])
  })

  it("throws on corrupt fragment without mutating the input doc", () => {
    const corruptDoc = new Y.Doc()
    writeYDocSchemaVersion(corruptDoc, 1)
    // 在 default 字段写入 Y.Text，与 Tiptap 期望的 XmlFragment 冲突
    corruptDoc.getText("default").insert(0, "corrupt")

    expect(() => migrateV1YDocToV2(corruptDoc)).toThrow()
    expect(readYDocSchemaVersion(corruptDoc)).toBe(1)
  })
})
