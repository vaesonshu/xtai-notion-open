/** 第一期支持的块类型，对应 Notion 式块模型 */
export type BlockType =
  | "paragraph"
  | "heading"
  | "bulletListItem"
  | "numberedListItem"
  | "checkListItem"
  | "quote"
  | "codeBlock"
  | "divider"
  | "image"
  | "table"
  | "canvas"

export type InlineStyles = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
}

export type InlineContent =
  | { type: "text"; text: string; styles: InlineStyles }
  | { type: "link"; href: string; content: InlineContent[] }
  | { type: "mention"; id: string; label: string; href: string }

export type TableContent = {
  headerRows: number
  rows: { cells: { content: InlineContent[] }[] }[]
}

/** 对外文档单位：每块有 id、类型、props，可选行内/表格内容与嵌套子块 */
export type Block = {
  id: string
  type: BlockType
  props: Record<string, unknown>
  content?: InlineContent[] | TableContent
  children: Block[]
}

/** 插入或更新块时的部分字段，id 与 children 可选 */
export type PartialBlock = {
  id?: string
  type: BlockType
  props?: Record<string, unknown>
  content?: InlineContent[] | TableContent
  children?: Block[]
}
