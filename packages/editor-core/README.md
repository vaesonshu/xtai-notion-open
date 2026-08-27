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
  createEditorExtensions,
  createEmptyDocument,
  createStarterDocument,
  documentFromYjs,
  isEditorDocument,
  toggleInlineMark,
} from "@xtai-notion/editor-core"
import { Editor } from "@tiptap/core"

const extensions = createEditorExtensions()
const editor = new Editor({
  extensions,
  content: createStarterDocument(),
})

toggleInlineMark(editor, "bold")
const json = editor.getJSON()
console.log(isEditorDocument(json)) // true
```

## 主要导出

| 类别 | 示例 |
|------|------|
| 文档 | `createEmptyDocument`、`createStarterDocument`、`isEditorDocument` |
| 扩展 | `createEditorExtensions`、`ImageUploadNode`、`CanvasBlockNode`（扩展工厂） |
| 命令 | `toggleInlineMark`、`setEditorLink`、`executeSlashCommand` |
| 协作 / Yjs | `documentFromYjs`、`externalizeCanvasFiles` |
| 类型 | `EditorDocument`、`EditorExtensionOptions`、`CollaborationUser` |

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
