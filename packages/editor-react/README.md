# @xtai-notion/editor-react

React 绑定层：Provider、Hooks、协作生命周期，以及 **ComponentsContext**（UI 原语注入）。

**许可证：** MIT

## 安装

```bash
pnpm add @xtai-notion/editor-react @xtai-notion/editor-core react react-dom
```

### Peer 依赖

| 包 | 版本 |
|----|------|
| `react` | `^18.0.0 \|\| ^19.0.0` |
| `react-dom` | `^18.0.0 \|\| ^19.0.0` |

`@xtai-notion/editor-core` 为 **dependency**，会随本包一起安装。

### 子路径

推荐从包根导入；深路径（`providers/`、`hooks/`、`collaboration/`）为稳定 public API：

```ts
import { createCollaborationSession } from "@xtai-notion/editor-react/collaboration"
import { useBlockEditor } from "@xtai-notion/editor-react/hooks/use-block-editor"
```

Monorepo 开发期 `package.json` `exports` 的 `development` 条件指向 `src/`；根入口发布产物在 `dist/`。

## 目录分层（`src/`）

| 目录 | 职责 |
| --- | --- |
| `react/providers/` | `EditorProvider`、`CollaborationEditorProvider`、生命周期与 Context |
| `react/hooks/` | 订阅 `BlockEditor` / 协作态（**无块操纵业务**） |
| `react/lib/` | 挂载 `BlockEditor` 的工厂（Yjs 空文档判断、rebind） |
| `react/context/` | `EditorContext` |
| `collaboration/` | Hocuspocus 会话与状态类型 |
| `schema/` | `defineReactBlockSpec`（React NodeView） |
| `components/` | `ComponentsProvider`（headless UI 原语注入） |

**约定：** 块 JSON、粘贴、命令等逻辑在 `@xtai-notion/editor-core`（尤其 `core/api`）；本包只做 React 绑定。自定义块样式请用 `editor-shadcn`，勿在本包引入 shadcn。

| 场景 | 推荐入口 |
| --- | --- |
| 页面挂载编辑区 | 根包 `EditorProvider` / `CollaborationEditorProvider` |
| UI 组件读门面 | `useBlockEditor()` → `blockEditor.tiptap` 或 `blockEditor.document` |
| 单测复用挂载逻辑 | `src/react/lib/block-editor-factory`（与 Provider 同源） |

## Headless 示例（无默认 UI）

仅使用 Tiptap 编辑区，不引入 shadcn 主题：

```tsx
"use client"

import { createStarterBlocks } from "@xtai-notion/editor-core"
import { EditorContent, EditorProvider } from "@xtai-notion/editor-react"

export function HeadlessEditor() {
  return (
    <EditorProvider initialContent={createStarterBlocks()}>
      <EditorContent className="prose min-h-48 outline-none" />
    </EditorProvider>
  )
}
```

> Headless 模式下 **无需** 引入 `@xtai-notion/editor-shadcn/style.css`。若使用 Slash 菜单、图片上传等 NodeView，需自行注入 `ComponentsProvider` 或安装主题包。

## 自定义 UI 原语（ComponentsProvider）

编辑器内部菜单、对话框等通过 `EditorComponents` 接口读取 Button、Popover、AlertDialog 等原语。可替换为任意设计系统：

```tsx
"use client"

import { createStarterBlocks } from "@xtai-notion/editor-core"
import {
  ComponentsProvider,
  EditorContent,
  EditorProvider,
  type EditorComponents,
} from "@xtai-notion/editor-react"

// 最小 stub：生产环境请补全 SlashMenu / Canvas 所需的全部原语
const components = {
  Button: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
  Input: (props) => <input {...props} />,
  Toggle: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
  Popover: ({ children }) => <div>{children}</div>,
  PopoverTrigger: ({ children }) => <>{children}</>,
  PopoverContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  Alert: ({ children, ...props }) => <div role="alert" {...props}>{children}</div>,
  AlertTitle: (props) => <h4 {...props} />,
  AlertDescription: (props) => <p {...props} />,
  Skeleton: (props) => <div aria-hidden {...props} />,
  AlertDialog: ({ children }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }) => <>{children}</>,
  AlertDialogContent: (props) => <div role="dialog" {...props} />,
  AlertDialogHeader: (props) => <div {...props} />,
  AlertDialogTitle: (props) => <h2 {...props} />,
  AlertDialogDescription: (props) => <p {...props} />,
  AlertDialogFooter: (props) => <div {...props} />,
  AlertDialogCancel: (props) => <button type="button" {...props} />,
  AlertDialogAction: (props) => <button type="button" {...props} />,
} satisfies EditorComponents

export function CustomUiEditor() {
  return (
    <ComponentsProvider value={components}>
      <EditorProvider initialContent={createStarterBlocks()}>
        <EditorContent />
      </EditorProvider>
    </ComponentsProvider>
  )
}
```

## 协作示例

```tsx
import {
  CollaborationEditorProvider,
  EditorContent,
} from "@xtai-notion/editor-react"
import type { CreateProvider } from "@xtai-notion/editor-react/collaboration"

export function CollabEditor({
  createProvider,
  user,
  documentId,
}: {
  createProvider: CreateProvider
  user: { id: string; name: string; color: string }
  documentId: string
}) {
  return (
    <CollaborationEditorProvider
      collaboration={{ createProvider, user, documentId }}
    >
      <EditorContent />
    </CollaborationEditorProvider>
  )
}
```

## 常用 Hooks

| Hook | 用途 |
|------|------|
| `useEditorInstance` | 获取 Tiptap `Editor`（须在 Provider 内且 editor 已就绪） |
| `useEditorText` | 订阅纯文本摘要 |
| `useEditorChange` | 订阅文档 JSON 变更 |
| `useCollaborationStatus` | 协作连接状态 |
| `useCollaborators` | 在线协作者列表 |

## 与主题包的关系

- 本包 **不得** 依赖 `@xtai-notion/editor-shadcn`
- 需要开箱即用 UI 时，请使用 `@xtai-notion/editor-shadcn` 的 `DocumentEditor` 或 `ShadcnEditorProvider`

## 开发（monorepo）

```bash
pnpm --filter @xtai-notion/editor-react build
pnpm --filter @xtai-notion/editor-react test
```
