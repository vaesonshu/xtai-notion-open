import type { Node as PMNode } from "@tiptap/pm/model"
import type { InlineContent, TableContent } from "../../model/types"
import { inlinePmToBlock } from "./inline"

export function countHeaderRows(tableNode: PMNode): number {
  let headerRows = 0
  for (let index = 0; index < tableNode.childCount; index += 1) {
    const row = tableNode.child(index)
    const allHeader =
      row.childCount > 0 &&
      Array.from({ length: row.childCount }).every(
        (_, cellIndex) => row.child(cellIndex).type.name === "tableHeader"
      )
    if (allHeader) {
      headerRows += 1
    } else {
      break
    }
  }
  return headerRows
}

export function tablePmToBlock(tableNode: PMNode): TableContent {
  const rows: TableContent["rows"] = []

  tableNode.forEach((rowNode) => {
    const cells: { content: InlineContent[] }[] = []
    rowNode.forEach((cellNode) => {
      // 单元格内通常是 paragraph 包裹的行内
      const inlineParts: InlineContent[] = []
      cellNode.forEach((block) => {
        inlineParts.push(...inlinePmToBlock(block.content))
      })
      cells.push({ content: inlineParts })
    })
    rows.push({ cells })
  })

  return {
    headerRows: countHeaderRows(tableNode),
    rows,
  }
}
