/**
 * 服务端安全入口：不含 @excalidraw/excalidraw 等浏览器侧依赖。
 * NestJS / 脚本应从此路径导入，避免 Node 解析 Excalidraw 子包失败。
 */
export type { EditorDocument } from "./core/types"
export { documentFromYjs, documentToPlainText } from "./core/yjs-document"
export { collectMentionIds } from "./core/mention-collect"
