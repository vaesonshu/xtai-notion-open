export type { CollaborationUser, EditorDocument, EditorExtensionOptions } from "./core/types.js"
export { createEditorExtensions } from "./core/extensions.js"
export {
  createEmptyDocument,
  createInitialDocument,
  createStarterDocument,
  isEditorDocument,
} from "./core/index.js"
export type { SlashCommand } from "./core/slash-commands.js"
export { SLASH_COMMANDS, executeSlashCommand, filterSlashCommands } from "./core/slash-commands.js"
export type { InlineMark } from "./core/commands.js"
export { setEditorLink, toggleInlineMark } from "./core/commands.js"