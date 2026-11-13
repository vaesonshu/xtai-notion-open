import { Node } from "@tiptap/core"
import type { CommandSpec } from "@tiptap/core"
import type {
  DOMOutputSpec,
  Node as PMNode,
  Schema,
  TagParseRule,
} from "@tiptap/pm/model"
import type { PartialBlock } from "../model/types"
import { propsToAttributes, type PropSchema } from "./prop-types"

/** 斜杠菜单项元数据，注册在 BlockConfig 上供 registry 聚合 */
export type SlashCommandMeta = {
  id: string
  label: string
  keywords: string[]
}

/** blockContent 节点承载的内容形态，驱动 convert 默认分支 */
export type BlockContentMode = "inline" | "none" | "table" | "text"

export type BlockConfig = {
  type: string
  propSchema: PropSchema
  content: BlockContentMode
  isAtom?: boolean
  isSelectable?: boolean
  /** paragraph 需同时 group: blockContent block（tableCell 内嵌） */
  alsoBlockGroup?: boolean
  /** codeBlock 等纯文本节点 */
  code?: boolean
  /** 可选：该块类型对应的斜杠菜单项（自定义块用） */
  slashCommands?: SlashCommandMeta[]
  /** 文件拖入该块时不显示 ProseMirror Dropcursor */
  disableDropCursor?: boolean
}

export type ConvertContext = {
  contentNode: PMNode
  blockId: string
}

export type BlockSpec = {
  config: BlockConfig
  node: Node
  toBlock?: (ctx: ConvertContext) => PartialBlock | null
  fromBlock?: (block: PartialBlock, schema: Schema) => PMNode
}

export type DeclarativeBlockImplementation = {
  parseHTML?: TagParseRule[]
  renderHTML?: (props: {
    node: PMNode
    HTMLAttributes: Record<string, unknown>
  }) => DOMOutputSpec
  /** 扩展自定义命令；CommandSpec 与 Tiptap addCommands 返回形状一致 */
  addCommands?: Record<string, CommandSpec>
}

function resolveNodeContent(config: BlockConfig): string {
  switch (config.content) {
    case "inline":
      return "inline*"
    case "text":
      return "text*"
    case "table":
      return "tableRow+"
    case "none":
      return ""
  }
}

/**
 * 根据 BlockConfig 生成 Tiptap blockContent 节点与 BlockSpec。
 * 复杂块（canvas / image）可在后续用 NodeView 版 spec 覆盖。
 */
export function defineBlockSpec(
  config: BlockConfig,
  implementation: DeclarativeBlockImplementation = {}
): BlockSpec {
  const node = Node.create({
    name: config.type,
    group: config.alsoBlockGroup ? "blockContent block" : "blockContent",
    content: resolveNodeContent(config),
    atom: config.isAtom,
    code: config.code,
    selectable: config.isSelectable ?? true,
    // TipTap 只会把白名单字段写入 PM NodeSpec，disableDropCursor 需走 extendNodeSchema
    ...(config.disableDropCursor
      ? {
          extendNodeSchema(thisExtension) {
            if (thisExtension.name === config.type) {
              return { disableDropCursor: true }
            }
            return {}
          },
        }
      : {}),
    addAttributes() {
      return propsToAttributes(config.propSchema)
    },
    parseHTML() {
      return implementation.parseHTML ?? []
    },
    ...(implementation.renderHTML
      ? { renderHTML: implementation.renderHTML }
      : {}),
    addCommands() {
      return implementation.addCommands ?? {}
    },
  })

  return { config, node }
}
