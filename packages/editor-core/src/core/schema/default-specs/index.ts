import type { Node } from "@tiptap/core"
import {
  blockContentExtensions,
  BLOCK_CONTENT_NODE_NAMES,
} from "../../block-schema/block-content"
import type { BlockType } from "../../block-schema/types"
import type { BlockConfig, BlockSpec } from "../block-spec"
import { BlockSchemaRegistry } from "../registry"

/** 内置块 content 模式，供 legacy 适配层使用 */
const BUILTIN_BLOCK_CONFIGS: Record<BlockType, BlockConfig> = {
  paragraph: {
    type: "paragraph",
    propSchema: {},
    content: "inline",
    alsoBlockGroup: true,
  },
  heading: {
    type: "heading",
    propSchema: { level: { default: 1 } },
    content: "inline",
  },
  bulletListItem: {
    type: "bulletListItem",
    propSchema: {},
    content: "inline",
  },
  numberedListItem: {
    type: "numberedListItem",
    propSchema: {},
    content: "inline",
  },
  checkListItem: {
    type: "checkListItem",
    propSchema: { checked: { default: false } },
    content: "inline",
  },
  quote: {
    type: "quote",
    propSchema: {},
    content: "inline",
  },
  codeBlock: {
    type: "codeBlock",
    propSchema: { language: { default: "" } },
    content: "text",
    code: true,
  },
  divider: {
    type: "divider",
    propSchema: {},
    content: "none",
    isAtom: true,
  },
  image: {
    type: "image",
    propSchema: {
      src: { default: "" },
      uploadStatus: { default: "idle" },
    },
    content: "none",
    isAtom: true,
  },
  table: {
    type: "table",
    propSchema: {},
    content: "table",
  },
  canvas: {
    type: "canvas",
    propSchema: {
      canvasId: { default: "" },
      snapshot: { default: "" },
    },
    content: "none",
    isAtom: true,
  },
}

/** 将现有 block-content Tiptap 扩展包装为 BlockSpec（P1 前过渡层） */
export function blockSpecFromExtension(
  extension: Node,
  config: BlockConfig
): BlockSpec {
  return { config, node: extension }
}

/** 从 block-content.ts 构建默认 registry */
export function createDefaultBlockSchemaRegistry(): BlockSchemaRegistry {
  const registry = new BlockSchemaRegistry()

  for (const extension of blockContentExtensions) {
    const type = extension.name as BlockType
    if (!BLOCK_CONTENT_NODE_NAMES.includes(type)) {
      continue
    }
    registry.register(
      blockSpecFromExtension(extension, BUILTIN_BLOCK_CONFIGS[type])
    )
  }

  return registry
}

export const DEFAULT_BUILTIN_BLOCK_COUNT = BLOCK_CONTENT_NODE_NAMES.length
