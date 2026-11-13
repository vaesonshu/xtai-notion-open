# @xtai-notion/editor-core

框架无关的 Tiptap 编辑器内核：文档 schema、扩展、命令、Slash 菜单与 Yjs 工具。

**许可证：** MIT · **运行时：** Node.js / 浏览器（无 React 依赖）

## 安装

```bash
pnpm add @xtai-notion/editor-core
```

本包将 Tiptap 3.x、Yjs、Excalidraw（Canvas 块）等作为 **dependencies** 一并安装，无需额外 peer。

## 适用场景

- 服务端文档解析、快照导出（如 NestJS API）
- 自定义 React/Vue 壳层，自行实现 UI
- 与 `@xtai-notion/editor-react` 组合使用

## 最小示例

```ts
import {
  BlockEditor,
  createStarterBlocks,
  isBlockArray,
  toggleInlineMark,
} from "@xtai-notion/editor-core"

const editor = new BlockEditor({
  initialContent: createStarterBlocks(),
})

toggleInlineMark(editor.tiptap, "bold")
console.log(isBlockArray(editor.document)) // true
```

## 可扩展 Block Schema

SDK 可通过 `createEditorSchema` 追加、覆盖或排除块类型，并与现有 `Block[]` / Yjs 协作兼容。

```ts
import {
  createEditorSchema,
  defineBlockSpec,
} from "@xtai-notion/editor-core/schema"
import { defineReactBlockSpec } from "@xtai-notion/editor-react"

// 追加自定义块
const callout = defineBlockSpec({
  type: "callout",
  propSchema: { variant: { default: "info" } },
  content: "inline",
  slashCommands: [
    { id: "callout", label: "提示框", keywords: ["callout", "提示"] },
  ],
})

const schema = createEditorSchema({ blocks: [callout] })

// React 层挂载 NodeView
const canvasWithUi = defineReactBlockSpec(
  {
    type: "canvas",
    propSchema: { canvasId: { default: "" }, snapshot: { default: "" } },
    content: "none",
    isAtom: true,
  },
  { component: MyCanvasNodeView }
)

const uiSchema = createEditorSchema({
  override: { canvas: canvasWithUi },
  omit: ["image"],
})

// 生成 Tiptap 扩展或传给 BlockEditor
const extensions = schema.getExtensions()
new BlockEditor({ editorSchema: schema })
```

完整 callout 示例见 `examples/callout-block.ts`；设计文档见仓库 `docs/superpowers/specs/2026-08-29-extensible-block-schema-design.md`。

## 块操纵 API（`src/core/api`）

| 场景                    | 推荐入口                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| React 页面、协作编辑    | `BlockEditor`（内部委托 `core/api`）                                                                                      |
| 单测、Agent、服务端脚本 | 包根或 `@xtai-notion/editor-core/api`：`insertBlocks(editor, …)`、`updateBlock`、`removeBlocks`、`handleMarkdownPaste` 等 |

`core/api` 函数的第一个参数是 Tiptap `Editor`（即 `blockEditor.tiptap`），不依赖 React。

## 主要导出

| 类别       | 示例                                                               |
| ---------- | ------------------------------------------------------------------ |
| 文档       | `createEmptyBlocks`、`createStarterBlocks`、`isBlockArray`         |
| 块操纵 API | `insertBlocks`、`updateBlock`、`removeBlocks`、`findContainerById` |
| 扩展       | `createEditorExtensions`、`ImageUploadNode`                        |
| 命令       | `toggleInlineMark`、`setEditorLink`、`executeSlashCommand`         |
| 协作 / Yjs | `documentFromYjs`、`externalizeCanvasFiles`                        |
| 类型       | `Block`、`EditorExtensionOptions`、`CollaborationUser`             |

完整 API 见 `dist/index.d.ts`（需先 `pnpm build`）。

## 与 React 包的关系

```
editor-core  →  无 UI、无 React
editor-react →  依赖 core，提供 Provider / Hooks
editor-shadcn → 依赖 core + react，提供默认 UI
```

**请勿** 在 core 中引入 React 或主题包；边界校验见仓库根目录 `pnpm check:editor-boundaries`。

## 开发（monorepo）

```bash
pnpm --filter @xtai-notion/editor-core build
pnpm --filter @xtai-notion/editor-core test
pnpm --filter @xtai-notion/editor-core typecheck
```
