/**
 * Callout 自定义块示例：演示如何用 defineBlockSpec + createEditorSchema 扩展编辑器。
 * 实际项目请在 React 层用 defineReactBlockSpec 挂载 NodeView。
 */
import {
  createEditorSchema,
  defineBlockSpec,
} from "@xtai-notion/editor-core/schema"

/** 声明式 callout 块：行内内容 + variant prop */
export const calloutSpec = defineBlockSpec(
  {
    type: "callout",
    propSchema: { variant: { default: "info" } },
    content: "inline",
    slashCommands: [
      {
        id: "callout",
        label: "提示框",
        keywords: ["callout", "提示", "高亮"],
      },
    ],
  },
  {
    parseHTML: [{ tag: 'div[data-type="callout"]' }],
    renderHTML: ({ HTMLAttributes }) => [
      "div",
      { "data-type": "callout", ...HTMLAttributes },
      0,
    ],
  }
)

/** 默认 11 块 + callout */
export const calloutEditorSchema = createEditorSchema({
  blocks: [calloutSpec],
})

/** 排除画板、仅保留 callout 等轻量块的示例 */
export const minimalEditorSchema = createEditorSchema({
  blocks: [calloutSpec],
  omit: ["canvas"],
})
