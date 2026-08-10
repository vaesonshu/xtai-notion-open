export type { CollaborationUser, EditorDocument, EditorExtensionOptions } from "./core/types"
export { createEditorExtensions } from "./core/extensions"
export {
  createEmptyDocument,
  createInitialDocument,
  createStarterDocument,
  isEditorDocument,
} from "./core/index"
export type { SlashCommand } from "./core/slash-commands"
export { SLASH_COMMANDS, executeSlashCommand, filterSlashCommands } from "./core/slash-commands"
export type { InlineMark } from "./core/commands"
export { setEditorLink, toggleInlineMark } from "./core/commands"