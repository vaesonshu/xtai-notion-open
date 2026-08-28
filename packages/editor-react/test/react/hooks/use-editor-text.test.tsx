import { describe, expect, it, vi } from "vitest"
import { getEditorText } from "@react-src/react/hooks/use-editor-text"

describe("getEditorText", () => {
  it("extracts readable text while preserving block boundaries", () => {
    const editor = {
      getJSON: vi.fn(() => ({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "标题" }] },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "待办" }],
                  },
                ],
              },
            ],
          },
        ],
      })),
    }
    expect(getEditorText(editor as any)).toBe("标题\n待办")
  })
})
