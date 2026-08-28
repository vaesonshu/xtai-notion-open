import { TiptapTransformer } from "@hocuspocus/transformer"
import { getSchema } from "@tiptap/core"
import * as Y from "yjs"
import type * as Yjs from "yjs"
import { blocksToPmDoc } from "../block-schema/convert"
import { createEditorExtensions } from "../extensions"
import { createLegacyEditorExtensions } from "./legacy-extensions"
import { legacyJsonToBlocks } from "./legacy-json-to-blocks"

/** 当前协作 Y.Doc 块 schema 版本；v1=旧 StarterKit 树，v2=块树。 */
export const CURRENT_SCHEMA_VERSION = 2

const YDOC_FIELD = "default"
const META_SCHEMA_VERSION_KEY = "schemaVersion"

/**
 * 测试/fixture：构造含 paragraph+mention 的 v1 协作快照字节。
 * 供 api 层 persistence 测试使用，避免直接依赖 @hocuspocus/transformer。
 */
export function encodeLegacyV1FixtureSnapshot(): Uint8Array {
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
    YDOC_FIELD,
    legacyExtensions
  )
  writeYDocSchemaVersion(doc, 1)
  return Y.encodeStateAsUpdate(doc)
}

/** 从 Y.Doc meta map 读取 schema 版本；缺省视为 v1 旧文档。 */
export function readYDocSchemaVersion(doc: Yjs.Doc): number {
  const version = doc.getMap("meta").get(META_SCHEMA_VERSION_KEY)
  if (typeof version === "number" && Number.isFinite(version)) {
    return version
  }
  return 1
}

/** 将 schema 版本写入 Y.Doc meta map（协作端与 DB 列对齐）。 */
export function writeYDocSchemaVersion(doc: Yjs.Doc, version: number): void {
  doc.getMap("meta").set(META_SCHEMA_VERSION_KEY, version)
}

/**
 * 将 v1 StarterKit Y.Doc 转为 v2 块树 Y.Doc。
 * 失败时抛错且不修改入参 doc（新文档由 transformer 单独创建）。
 */
export function migrateV1YDocToV2(doc: Yjs.Doc): Yjs.Doc {
  const legacyExtensions = createLegacyEditorExtensions()
  const legacyJson = TiptapTransformer.extensions(legacyExtensions).fromYdoc(
    doc,
    YDOC_FIELD
  )
  const blocks = legacyJsonToBlocks(legacyJson)
  const newExtensions = createEditorExtensions()
  const schema = getSchema(newExtensions)
  const pmDoc = blocksToPmDoc(blocks, schema)
  const migratedDoc = TiptapTransformer.extensions(newExtensions).toYdoc(
    pmDoc.toJSON(),
    YDOC_FIELD,
    newExtensions
  )
  writeYDocSchemaVersion(migratedDoc, CURRENT_SCHEMA_VERSION)
  return migratedDoc
}
