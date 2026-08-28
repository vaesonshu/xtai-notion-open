import { describe, expect, it } from "vitest"
import { legacyJsonToBlocks } from "./legacy-json-to-blocks"

describe("legacyJsonToBlocks", () => {
  it("turns nested bullet lists into children", () => {
    const blocks = legacyJsonToBlocks({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "parent" }],
                },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "child" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    expect(blocks[0]?.type).toBe("bulletListItem")
    expect(blocks[0]?.children[0]?.type).toBe("bulletListItem")
  })

  it("flattens multi-paragraph blockquote", () => {
    const blocks = legacyJsonToBlocks({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "a" }] },
            { type: "paragraph", content: [{ type: "text", text: "b" }] },
          ],
        },
      ],
    })
    expect(blocks[0]?.type).toBe("quote")
    expect(blocks[0]?.children[0]?.type).toBe("paragraph")
  })

  it("maps table, canvasBlock, mention, and imageUpload", () => {
    const blocks = legacyJsonToBlocks({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "H" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "canvasBlock",
          attrs: { canvasId: "c1", snapshot: "" },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: {
                id: "doc-target",
                label: "T",
                href: "/documents/doc-target",
              },
            },
          ],
        },
        { type: "imageUpload" },
      ],
    })
    expect(blocks.map((block) => block.type)).toEqual([
      "table",
      "canvas",
      "paragraph",
      "image",
    ])
    expect(blocks[2]?.content).toEqual([
      {
        type: "mention",
        id: "doc-target",
        label: "T",
        href: "/documents/doc-target",
      },
    ])
    expect(blocks[3]?.props).toMatchObject({ uploadStatus: "idle" })
  })
})
