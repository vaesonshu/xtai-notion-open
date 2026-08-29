import { describe, expect, it } from "vitest"
import { isExternalFileDrag } from "@core/extensions/block-dropcursor"

describe("isExternalFileDrag", () => {
  it("detects OS file drags", () => {
    const event = {
      dataTransfer: {
        types: ["Files"],
      },
    } as DragEvent

    expect(isExternalFileDrag(event, {})).toBe(true)
  })

  it("ignores internal block reorder drags", () => {
    const event = {
      dataTransfer: {
        types: ["Files"],
      },
    } as DragEvent

    expect(
      isExternalFileDrag(event, {
        dragging: { slice: {} as never },
      })
    ).toBe(false)
  })

  it("ignores text-only drags", () => {
    const event = {
      dataTransfer: {
        types: ["text/plain"],
      },
    } as DragEvent

    expect(isExternalFileDrag(event, {})).toBe(false)
  })
})
