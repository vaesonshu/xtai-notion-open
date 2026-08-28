import type { Extensions } from "@tiptap/core"
import { createEditorSchema } from "../schema/create-editor-schema"
import type { EditorExtensionOptions } from "../types"
import { buildBlockSchemaExtensions } from "./build-block-schema-extensions"

export type { EditorExtensionOptions } from "../types"
export { MentionNode } from "./mention-node"

/** 默认编辑器扩展：块 schema（与 createBlockSchemaExtensions 等价） */
export function createEditorExtensions(
  options: EditorExtensionOptions = {}
): Extensions {
  return createBlockSchemaExtensions(options)
}

/** 块文档 schema：Doc/blockGroup/blockContainer + registry 中的 blockContent 节点 */
export function createBlockSchemaExtensions(
  options: EditorExtensionOptions = {}
): Extensions {
  return createEditorSchema().getExtensions(options)
}

/** 使用指定 EditorSchema 生成扩展（SDK 自定义块时使用） */
export function createBlockSchemaExtensionsFromRegistry(
  options: EditorExtensionOptions,
  registry: ReturnType<typeof createEditorSchema>["registry"]
): Extensions {
  return buildBlockSchemaExtensions(registry, options)
}
