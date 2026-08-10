import { describe, expect, it } from "vitest"
import { formatEditorSnapshot } from "./playground-utils"

describe("formatEditorSnapshot", () => {
  it("formats the latest editor document as inspectable JSON", () => {
    expect(formatEditorSnapshot({ type: "doc", content: [] })).toBe(
      '{\n  "type": "doc",\n  "content": []\n}',
    )
  })
})
