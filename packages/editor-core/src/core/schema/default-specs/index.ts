import type { Node } from "@tiptap/core"
import {
  CodeBlockContent,
  ImageBlock,
  BlockTable,
  CanvasBlock,
} from "../../block-schema/legacy-complex-blocks"
import type { BlockType } from "../../block-schema/types"
import type { BlockConfig, BlockSpec } from "../block-spec"
import { BlockSchemaRegistry } from "../registry"
import { bulletListItemSpec } from "./bullet-list-item"
import { checkListItemSpec } from "./check-list-item"
import { dividerSpec } from "./divider"
import { headingSpec } from "./heading"
import { numberedListItemSpec } from "./numbered-list-item"
import { paragraphSpec } from "./paragraph"
import { quoteSpec } from "./quote"

/** P1 已迁移的简单块 spec */
export const SIMPLE_BLOCK_SPECS: BlockSpec[] = [
  paragraphSpec,
  headingSpec,
  bulletListItemSpec,
  numberedListItemSpec,
  checkListItemSpec,
  quoteSpec,
  dividerSpec,
]

/** P2 前复杂块仍从 legacy-complex-blocks 包装（待迁移） */
const LEGACY_COMPLEX_CONFIGS: Record<
  Extract<BlockType, "codeBlock" | "image" | "table" | "canvas">,
  BlockConfig
> = {
  codeBlock: {
    type: "codeBlock",
    propSchema: { language: { default: "" } },
    content: "text",
    code: true,
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

const LEGACY_COMPLEX_NODES: Record<
  keyof typeof LEGACY_COMPLEX_CONFIGS,
  Node
> = {
  codeBlock: CodeBlockContent,
  image: ImageBlock,
  table: BlockTable,
  canvas: CanvasBlock,
}

/** 将 Tiptap 扩展包装为 BlockSpec（复杂块过渡层） */
export function blockSpecFromExtension(
  extension: Node,
  config: BlockConfig
): BlockSpec {
  return { config, node: extension }
}

/** 内置块 type 顺序，供 block-content 与测试使用 */
export const DEFAULT_BLOCK_TYPES: BlockType[] = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
  "codeBlock",
  "divider",
  "image",
  "table",
  "canvas",
]

/** 从 default-specs + legacy 包装构建默认 registry */
export function createDefaultBlockSchemaRegistry(): BlockSchemaRegistry {
  const registry = new BlockSchemaRegistry()

  for (const spec of SIMPLE_BLOCK_SPECS) {
    registry.register(spec)
  }

  for (const type of ["codeBlock", "image", "table", "canvas"] as const) {
    registry.register(
      blockSpecFromExtension(
        LEGACY_COMPLEX_NODES[type],
        LEGACY_COMPLEX_CONFIGS[type]
      )
    )
  }

  return registry
}

export const DEFAULT_BUILTIN_BLOCK_COUNT = DEFAULT_BLOCK_TYPES.length
