export {
  ShadcnEditorProvider,
  defaultEditorComponents,
} from "./shadcn-editor-provider"
export type { DocumentEditorProps } from "./components/editor/document-editor"
export { DocumentEditor } from "./components/editor/document-editor"
export type { EditorSurfaceProps } from "./components/editor/editor-surface"
export { EditorSurface } from "./components/editor/editor-surface"
export { CollaborationStatus } from "./components/collaboration-status"
export { SlashMenu } from "./components/menus/slash-menu"
export { MentionMenu } from "./components/menus/mention-menu"
export type { ShouldShowBubbleToolbarProps } from "./components/menus/bubble-toolbar"
export {
  BubbleToolbar,
  shouldShowBubbleToolbar,
} from "./components/menus/bubble-toolbar"
export type { AiWriteHostHandlers } from "./components/ai/ai-write-context"
export { AiWriteHostContext } from "./components/ai/ai-write-context"
export type {
  AiWritePromptBarProps,
  AiWritingStatus,
  AiWritePreset,
} from "./components/ai/ai-write-prompt-bar"
export {
  AiWritePromptBar,
  SLASH_AI_WRITE_PRESETS,
  SELECTION_AI_WRITE_PRESETS,
} from "./components/ai/ai-write-prompt-bar"
export type { AiWritePromptAnchorProps } from "./components/ai/ai-write-prompt-anchor"
export { AiWritePromptAnchor } from "./components/ai/ai-write-prompt-anchor"
export type { AiWriteDraftProps } from "./components/ai/ai-write-draft"
export { AiWriteDraft } from "./components/ai/ai-write-draft"
export { BlockHandle } from "./components/handles/block-handle"
export { ImageUpload, useImageUpload } from "./components/nodes/image-upload"
export type { ImageUploadControls } from "./components/nodes/image-upload"
export { TableGridPicker } from "./components/menus/table-grid-picker"
export type { TableGridPickerProps } from "./components/menus/table-grid-picker"
export { TableMenu } from "./components/menus/table-menu"
export { CanvasBlockNode } from "./components/nodes/canvas-block-node-extension"
export { createImageBlockSpec } from "./components/nodes/image-block-node-extension"
/** @deprecated 请改用 createImageBlockSpec */
export { ImageUploadNode } from "./components/nodes/image-upload-node-extension"
