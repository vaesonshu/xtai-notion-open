import type { Extensions } from "@tiptap/core"
import type { EditorExtensionOptions } from "../types"
import { buildBlockSchemaExtensions } from "../extensions/build-block-schema-extensions"
import type { BlockSpec } from "./block-spec"
import {
  createDefaultBlockSchemaRegistry,
  DEFAULT_BUILTIN_BLOCK_COUNT,
} from "./default-specs"
import { BlockSchemaRegistry } from "./registry"

export type CreateEditorSchemaOptions = {
  /** 追加自定义块；type 冲突时抛错 */
  blocks?: BlockSpec[]
  /** 按 type 覆盖或追加内置块 */
  override?: Record<string, BlockSpec>
  /** 从最终 registry 排除的块 type */
  omit?: string[]
}

export type EditorSchema = {
  registry: BlockSchemaRegistry
  blockTypes: readonly string[]
  getExtensions: (options?: EditorExtensionOptions) => Extensions
}

function applySchemaOptions(
  base: BlockSchemaRegistry,
  options?: CreateEditorSchemaOptions
): BlockSchemaRegistry {
  let registry = base.clone()

  if (options?.override) {
    for (const spec of Object.values(options.override)) {
      if (registry.get(spec.config.type)) {
        registry.replace(spec)
      } else {
        registry.register(spec)
      }
    }
  }

  if (options?.blocks) {
    for (const spec of options.blocks) {
      registry.register(spec)
    }
  }

  if (options?.omit?.length) {
    registry = registry.without(options.omit)
  }

  return registry
}

/** SDK 入口：合并内置块与自定义/覆盖块，生成可扩展 schema */
export function createEditorSchema(
  options?: CreateEditorSchemaOptions
): EditorSchema {
  const registry = applySchemaOptions(
    createDefaultBlockSchemaRegistry(),
    options
  )

  return {
    registry,
    blockTypes: registry.getAllBlockTypes(),
    getExtensions: (extensionOptions) =>
      buildBlockSchemaExtensions(registry, extensionOptions),
  }
}

export { DEFAULT_BUILTIN_BLOCK_COUNT }
