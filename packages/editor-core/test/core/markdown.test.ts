import { describe, expect, it } from "vitest"
import { blocksToMarkdown, markdownToBlocks } from "@core/markdown"

describe("markdown roundtrip", () => {
  it("converts heading and list blocks to markdown and back", () => {
    const blocks = markdownToBlocks(
      "# Title\n\nHello world\n\n- item one\n\n> quote line"
    )
    const markdown = blocksToMarkdown(blocks)
    expect(markdown).toContain("# Title")
    expect(markdown).toContain("Hello world")
    expect(markdown).toContain("- item one")
    expect(markdown).toContain("> quote line")
  })
})
