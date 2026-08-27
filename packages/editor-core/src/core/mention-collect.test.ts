import { describe, expect, it } from "vitest"
import { collectMentionIds } from "./mention-collect"

describe("collectMentionIds", () => {
  it("collects mention ids from nested content", () => {
    const ids = collectMentionIds({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "see " },
            {
              type: "mention",
              attrs: { id: "doc-a", label: "A", href: "/documents/doc-a" },
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "mention",
                      attrs: { id: "doc-b", label: "B" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    expect(ids).toEqual(["doc-a", "doc-b"])
  })

  it("returns empty array when no mentions", () => {
    expect(
      collectMentionIds({ type: "doc", content: [{ type: "paragraph" }] })
    ).toEqual([])
  })
})
