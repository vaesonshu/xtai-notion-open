export type { PropSchema, PropSpec } from "./prop-types"
export { propsToAttributes } from "./prop-types"

export type {
  BlockConfig,
  BlockContentMode,
  BlockSpec,
  ConvertContext,
  DeclarativeBlockImplementation,
  SlashCommandMeta,
} from "./block-spec"
export { defineBlockSpec } from "./block-spec"

export { BlockSchemaRegistry } from "./registry"

export type {
  CreateEditorSchemaOptions,
  EditorSchema,
} from "./create-editor-schema"
export {
  createEditorSchema,
} from "./create-editor-schema"

export {
  blockSpecFromExtension,
  createDefaultBlockSchemaRegistry,
  DEFAULT_BUILTIN_BLOCK_COUNT,
  BUILTIN_BLOCK_SPECS,
} from "./default-specs"
export { canvasSpec } from "./default-specs/canvas"
export { imageSpec } from "./default-specs/image"
