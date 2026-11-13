import { Node, mergeAttributes } from "@tiptap/core"
import { generateBlockId } from "../model/ids"

/** 块文档根节点：子树必须是 blockGroup */
export const BlockDoc = Node.create({
  name: "doc",
  topNode: true,
  content: "blockGroup",
})

/** 同级块列表容器，对应 Block[] 的一层 */
export const BlockGroup = Node.create({
  name: "blockGroup",
  content: "blockContainer+",

  parseHTML() {
    return [{ tag: 'div[data-node-type="blockGroup"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-node-type": "blockGroup" }, HTMLAttributes),
      0,
    ]
  },
})

/**
 * 单块外壳：稳定 id 供协同与块 API 引用；
 * 第一个子节点为 blockContent，可选第二个子节点为嵌套 blockGroup。
 */
export const BlockContainer = Node.create({
  name: "blockContainer",
  content: "blockContent blockGroup?",
  defining: true,
  // 侧栏拖拽钮点击时用 NodeSelection 整块选中
  selectable: true,

  addAttributes() {
    return {
      id: {
        // 新建容器时自动生成 UUID，往返转换时由 blocksToPmDoc 写入已有 id
        default: () => generateBlockId(),
        parseHTML: (element) => element.getAttribute("data-id"),
        renderHTML: (attributes) =>
          attributes.id ? { "data-id": attributes.id } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="blockContainer"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-node-type": "blockContainer" }, HTMLAttributes),
      0,
    ]
  },
})
