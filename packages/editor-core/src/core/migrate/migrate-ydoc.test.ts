import * as Y from "yjs"
import { describe, expect, it } from "vitest"
import {
  CURRENT_SCHEMA_VERSION,
  readYDocSchemaVersion,
  writeYDocSchemaVersion,
} from "./migrate-ydoc"

describe("migrate-ydoc", () => {
  it("defaults missing meta schemaVersion to current version", () => {
    const doc = new Y.Doc()
    expect(readYDocSchemaVersion(doc)).toBe(CURRENT_SCHEMA_VERSION)
    doc.destroy()
  })

  it("round-trips schemaVersion in Y.Doc meta map", () => {
    const doc = new Y.Doc()
    writeYDocSchemaVersion(doc, CURRENT_SCHEMA_VERSION)
    expect(readYDocSchemaVersion(doc)).toBe(CURRENT_SCHEMA_VERSION)
    doc.destroy()
  })
})
