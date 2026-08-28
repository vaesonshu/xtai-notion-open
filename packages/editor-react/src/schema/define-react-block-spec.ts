import type { ComponentType } from "react"
import { ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react"
import {
  defineBlockSpec,
  type BlockConfig,
  type BlockSpec,
  type DeclarativeBlockImplementation,
} from "@xtai-notion/editor-core/schema"

export type DefineReactBlockSpecOptions = DeclarativeBlockImplementation & {
  /** React NodeView 组件 */
  component: ComponentType<NodeViewProps>
  /** 运行时注入 Tiptap 扩展 options（如 canvas 的 upload handler） */
  addOptions?: () => Record<string, unknown>
}

/**
 * 在 React 层为 blockContent 挂载 NodeView，core 侧仍用 defineBlockSpec 生成 schema。
 */
export function defineReactBlockSpec(
  config: BlockConfig,
  options: DefineReactBlockSpecOptions
): BlockSpec {
  const { component, addOptions, ...implementation } = options
  const base = defineBlockSpec(config, implementation)

  return withReactNodeView(base, { component, addOptions })
}

/** 为已有 BlockSpec 注入 React NodeView（常用于 override 内置 canvas/image） */
export function withReactNodeView(
  spec: BlockSpec,
  options: Pick<DefineReactBlockSpecOptions, "component" | "addOptions">
): BlockSpec {
  const node = spec.node.extend({
    ...(options.addOptions ? { addOptions: options.addOptions } : {}),
    addNodeView() {
      return ReactNodeViewRenderer(options.component)
    },
  })

  return {
    config: spec.config,
    node,
    toBlock: spec.toBlock,
    fromBlock: spec.fromBlock,
  }
}
