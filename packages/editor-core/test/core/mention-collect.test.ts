import { describe, expect, it } from "vitest"
import type { Block } from "@core/block-schema/types"
import { collectMentionIds } from "@core/mention-collect"

describe("collectMentionIds", () => {
  it("collects mention ids from nested content", () => {
    const blocks: Block[] = [
      {
        id: "block-1",
        type: "paragraph",
        props: {},
        content: [
          { type: "text", text: "see ", styles: {} },
          {
            type: "mention",
            id: "doc-a",
            label: "A",
            href: "/documents/doc-a",
          },
        ],
        children: [],
      },
      {
        id: "block-2",
        type: "bulletListItem",
        props: {},
        content: [
          {
            type: "mention",
            id: "doc-b",
            label: "B",
            href: "",
          },
        ],
        children: [],
      },
    ]

    expect(collectMentionIds(blocks)).toEqual(["doc-a", "doc-b"])
  })

  it("returns empty array when no mentions", () => {
    const blocks: Block[] = [
      {
        id: "block-1",
        type: "paragraph",
        props: {},
        content: [],
        children: [],
      },
    ]
    expect(collectMentionIds(blocks)).toEqual([])
  })
})
