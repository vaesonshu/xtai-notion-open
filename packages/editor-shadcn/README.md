# @xtai-notion/editor-shadcn

基于 shadcn 基元的默认编辑器 UI 主题，开箱即用。

## 安装

```bash
pnpm add @xtai-notion/editor-shadcn @xtai-notion/editor-react @xtai-notion/editor-core react react-dom
```

## 示例

```tsx
import { DocumentEditor } from "@xtai-notion/editor-shadcn"
import { createStarterDocument } from "@xtai-notion/editor-core"
import "@xtai-notion/editor-shadcn/style.css"

export function Page() {
  return <DocumentEditor content={createStarterDocument()} />
}
```
