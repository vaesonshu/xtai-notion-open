import type * as Yjs from "yjs"

const META_SCHEMA_VERSION_KEY = "schemaVersion"

/** 当前协作 Y.Doc 块 schema 版本（块树 Block[]）。 */
export const CURRENT_SCHEMA_VERSION = 2

/** 从 Y.Doc meta map 读取 schema 版本；缺省视为当前版本。 */
export function readYDocSchemaVersion(doc: Yjs.Doc): number {
  const version = doc.getMap("meta").get(META_SCHEMA_VERSION_KEY)
  if (typeof version === "number" && Number.isFinite(version)) {
    return version
  }
  return CURRENT_SCHEMA_VERSION
}

/** 将 schema 版本写入 Y.Doc meta map（协作端与 DB 列对齐）。 */
export function writeYDocSchemaVersion(doc: Yjs.Doc, version: number): void {
  doc.getMap("meta").set(META_SCHEMA_VERSION_KEY, version)
}
