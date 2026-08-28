import { Table } from "@tiptap/extension-table"
import type { BlockSpec } from "../block-spec"

/** 表格外壳属于 blockContent；行列单元格仍用官方 tableRow/Header/Cell */
export const tableSpec: BlockSpec = {
  config: {
    type: "table",
    propSchema: {},
    content: "table",
  },
  node: Table.extend({
    name: "table",
    group: "blockContent",
  }),
}
