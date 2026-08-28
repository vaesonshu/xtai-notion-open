import { describe, expect, it } from "vitest"
import { formatEditorSnapshot } from "./playground-utils"

describe("formatEditorSnapshot", () => {
  it("formats the latest block document as inspectable JSON", () => {
    expect(
      formatEditorSnapshot([
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "paragraph",
          props: {},
          content: [],
          children: [],
        },
      ])
    ).toContain('"type": "paragraph"')
  })
})
