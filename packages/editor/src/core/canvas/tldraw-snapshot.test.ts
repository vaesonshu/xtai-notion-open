import type { TLStoreSnapshot } from "tldraw"
import { describe, expect, it } from "vitest"
import {
  createCanvasBlockId,
  parseTldrawDocumentSnapshot,
  stringifyTldrawDocumentSnapshot,
} from "./tldraw-snapshot"

describe("tldraw-snapshot", () => {
  it("round-trips document snapshot JSON", () => {
    const document = {
      schema: { schemaVersion: 2 as const, sequences: {} },
      store: {},
    } satisfies TLStoreSnapshot
    const raw = stringifyTldrawDocumentSnapshot(document)
    expect(parseTldrawDocumentSnapshot(raw)).toEqual(document)
  })

  it("returns null for invalid snapshot strings", () => {
    expect(parseTldrawDocumentSnapshot("")).toBeNull()
    expect(parseTldrawDocumentSnapshot("{bad json")).toBeNull()
  })

  it("creates stable canvas ids", () => {
    expect(createCanvasBlockId()).toMatch(
      /^([0-9a-f-]{36}|canvas-\d+-[a-z0-9]+)$/
    )
  })
})
