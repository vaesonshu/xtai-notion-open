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

```ts
import { createCollaborationSession } from "@xtai-notion/editor-react/collaboration"
```

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
