import { describe, expect, it } from "vitest"
import {
  createCanvasBlockId,
  hasCanvasContent,
  parseCanvasSnapshot,
  stringifyCanvasSnapshot,
  type CanvasSnapshot,
} from "@core/canvas/canvas-snapshot"

describe("canvas-snapshot", () => {
  it("round-trips canvas snapshot JSON", () => {
    const snapshot = {
      elements: [
        {
          id: "rect-1",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 100,
          height: 80,
        },
      ],
      files: {
        "file-1": {
          mimeType: "image/png",
          id: "file-1",
          dataURL: "data:image/png;base64,abc",
          created: 1,
        },
      },
    } as unknown as CanvasSnapshot
    const raw = stringifyCanvasSnapshot(snapshot)
    expect(parseCanvasSnapshot(raw)).toEqual(snapshot)
  })

  it("returns null for invalid snapshot strings", () => {
    expect(parseCanvasSnapshot("")).toBeNull()
    expect(parseCanvasSnapshot("{bad json")).toBeNull()
    expect(parseCanvasSnapshot(JSON.stringify({ files: {} }))).toBeNull()
  })

  it("creates stable canvas ids", () => {
    expect(createCanvasBlockId()).toMatch(
      /^([0-9a-f-]{36}|canvas-\d+-[a-z0-9]+)$/
    )
  })

  it("detects non-empty canvas content", () => {
    const empty = stringifyCanvasSnapshot({ elements: [] })
    expect(hasCanvasContent(empty)).toBe(false)

    const deletedOnly = stringifyCanvasSnapshot({
      elements: [{ id: "a", isDeleted: true } as CanvasSnapshot["elements"][0]],
    })
    expect(hasCanvasContent(deletedOnly)).toBe(false)

    const withShape = stringifyCanvasSnapshot({
      elements: [
        {
          id: "rect-1",
          type: "rectangle",
          isDeleted: false,
        } as CanvasSnapshot["elements"][0],
      ],
    })
    expect(hasCanvasContent(withShape)).toBe(true)
  })
})
