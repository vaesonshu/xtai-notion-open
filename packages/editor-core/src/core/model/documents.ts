import { generateBlockId } from "./ids"
import type { Block, InlineContent } from "./types"

function textContent(text: string): InlineContent[] {
  return [{ type: "text", text, styles: {} }]
}

function createBlock(
  type: Block["type"],
  options: {
    props?: Record<string, unknown>
    content?: InlineContent[]
  } = {}
): Block {
  return {
    id: generateBlockId(),
    type,
    props: options.props ?? {},
    content: options.content,
    children: [],
  }
}

/** 空文档：恰好一块可聚焦的空段落 */
export function createEmptyBlocks(): Block[] {
  return [
    createBlock("paragraph", {
      content: [],
    }),
  ]
}

/** 种子文档：演示各常见块类型 */
export function createStarterBlocks(): Block[] {
  return [
    createBlock("heading", {
      props: { level: 1 },
      content: textContent("让知识真正流动起来"),
    }),
    createBlock("paragraph", {
      content: textContent("这是一个可编辑的知识文档。"),
    }),
    createBlock("bulletListItem", {
      content: textContent("记录想法"),
    }),
    createBlock("quote", {
      content: textContent("好的工具让秩序自然出现。"),
    }),
    createBlock("codeBlock", {
      content: textContent("const knowledge = true"),
    }),
  ]
}

function isBlock(value: unknown): value is Block {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const candidate = value as {
    id?: unknown
    type?: unknown
    children?: unknown
  }

  return (
    typeof candidate.id === "string" &&
    typeof candidate.type === "string" &&
    Array.isArray(candidate.children)
  )
}

/** 运行时校验：值是否为 Block[]（每项需有 id、type、children 数组） */
export function isBlockArray(value: unknown): value is Block[] {
  return Array.isArray(value) && value.every(isBlock)
}
