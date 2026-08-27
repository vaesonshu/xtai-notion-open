# @xtai-notion/editor-shadcn

基于 shadcn / Base UI 的默认编辑器 UI 主题：`DocumentEditor`、工具栏、Slash 菜单、协作状态等。

**许可证：** MIT

## 安装

```bash
pnpm add @xtai-notion/editor-shadcn @xtai-notion/editor-react @xtai-notion/editor-core react react-dom
```

### Peer 依赖

| 包 | 版本 |
|----|------|
| `react` | `^18.0.0 \|\| ^19.0.0` |
| `react-dom` | `^18.0.0 \|\| ^19.0.0` |

## 样式引入

主题包依赖 Tailwind 工具类，**必须**在应用入口引入样式：

```tsx
// Next.js app/layout.tsx 或 Vite main.tsx
import "@xtai-notion/editor-shadcn/style.css"
```

Headless 用户（仅用 `@xtai-notion/editor-react`）可跳过此 CSS。

## 最小示例（本地编辑）

```tsx
"use client"

import { createStarterDocument } from "@xtai-notion/editor-core"
import { DocumentEditor } from "@xtai-notion/editor-shadcn"
import "@xtai-notion/editor-shadcn/style.css"

export function Page() {
  return (
    <DocumentEditor
      content={createStarterDocument()}
      onChange={(doc) => console.log(doc)}
    />
  )
}
```

## 协作模式

`content` 与 `collaboration` **互斥**，与迁移前 `@workspace/editor` 行为一致：

```tsx
<DocumentEditor
  collaboration={{
    createProvider,
    user: { id: "u1", name: "Ada", color: "#24866B" },
    documentId: "doc-123",
  }}
  mentionProvider={searchDocuments}
  imageUpload={uploadToStorage}
/>
```

## 进阶：仅注入 UI 原语

若已有自定义 `EditorProvider`，只需 shadcn 组件映射：

```tsx
import { ShadcnEditorProvider } from "@xtai-notion/editor-shadcn"
import { EditorProvider, EditorContent } from "@xtai-notion/editor-react"

export function ThemedShell({ children }: { children: React.ReactNode }) {
  return (
    <ShadcnEditorProvider>
      <EditorProvider>{children}</EditorProvider>
    </ShadcnEditorProvider>
  )
}
```

## Next.js 配置

Monorepo 内需 transpile 三包（`apps/web/next.config.ts` 已配置）：

```ts
transpilePackages: [
  "@xtai-notion/editor-core",
  "@xtai-notion/editor-react",
  "@xtai-notion/editor-shadcn",
]
```

## 包内 vendored UI

主题包内置编辑器所需的最小 UI 原语（`src/ui/*`），**不**依赖私有 `@workspace/ui`，便于 npm 发布。

## 开发（monorepo）

```bash
pnpm --filter @xtai-notion/editor-shadcn build
pnpm --filter @xtai-notion/editor-shadcn test
```

构建后 `exports["./style.css"]` 指向 `dist/style.css`。
