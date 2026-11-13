/** Markdown 导入导出统一入口，实现位于 `core/api` */
export { blocksToMarkdown } from "../api/exporters/markdown/serialize"
export {
  blocksToHtml,
  wrapExportHtmlDocument,
} from "../api/exporters/html/html-serialize"
export { markdownToBlocks } from "../api/parsers/markdown/parse"
export {
  clipboardHtmlHasRichStructure,
  looksLikeMarkdown,
} from "../api/parsers/markdown/detect"
export { handleMarkdownPaste } from "../api/clipboard/fromClipboard/handleMarkdownPaste"
