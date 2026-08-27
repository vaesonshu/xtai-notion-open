# @xtai-notion/editor-react

React 绑定层：Provider、Hooks、协作生命周期与 UI 原语注入（ComponentsContext）。

## 安装

```bash
pnpm add @xtai-notion/editor-react @xtai-notion/editor-core react react-dom
```

## Headless 示例

```tsx
import { EditorProvider, EditorContent } from "@xtai-notion/editor-react"
import { createStarterDocument } from "@xtai-notion/editor-core"

export function HeadlessEditor() {
  return (
    <EditorProvider initialContent={createStarterDocument()}>
      <EditorContent />
    </EditorProvider>
  )
}
```

## 自定义 UI 原语

```tsx
import {
  ComponentsProvider,
  EditorProvider,
  type EditorComponents,
} from "@xtai-notion/editor-react"

const components: EditorComponents = {
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  // ...实现其余原语
}

export function CustomUiEditor() {
  return (
    <ComponentsProvider value={components}>
      <EditorProvider>{/* ... */}</EditorProvider>
    </ComponentsProvider>
  )
}
```
