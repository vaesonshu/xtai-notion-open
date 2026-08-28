import { describe, expect, it } from "vitest"
import { getDraggableBlockFromElement } from "./block-side-menu-plugin"

describe("getDraggableBlockFromElement", () => {
  it("walks up to the nearest blockContainer with data-id", () => {
    const viewDom = document.createElement("div")
    const blockContainer = document.createElement("div")
    const paragraph = document.createElement("p")

    blockContainer.setAttribute("data-node-type", "blockContainer")
    blockContainer.setAttribute("data-id", "block-1")
    paragraph.textContent = "hello"

    blockContainer.appendChild(paragraph)
    viewDom.appendChild(blockContainer)

    const view = {
      dom: viewDom,
    } as unknown as Parameters<typeof getDraggableBlockFromElement>[1]

    const block = getDraggableBlockFromElement(paragraph, view)

    expect(block?.id).toBe("block-1")
    expect(block?.node).toBe(blockContainer)
  })
})
