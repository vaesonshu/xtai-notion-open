export type { PropSchema, PropSpec } from "./prop-types"
export { propsToAttributes } from "./prop-types"

export type {
  BlockConfig,
  BlockContentMode,
  BlockSpec,
  ConvertContext,
  DeclarativeBlockImplementation,
} from "./block-spec"
export { defineBlockSpec } from "./block-spec"

export { BlockSchemaRegistry } from "./registry"

export type {
  CreateEditorSchemaOptions,
  EditorSchema,
} from "./create-editor-schema"
export {
  createEditorSchema,
  DEFAULT_BUILTIN_BLOCK_COUNT,
} from "./create-editor-schema"

export {
  blockSpecFromExtension,
  createDefaultBlockSchemaRegistry,
} from "./default-specs"
