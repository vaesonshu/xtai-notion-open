# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```

## 编辑器 SDK 包结构

本仓库将编辑器拆分为可开源发布的 **MIT** 三包（npm scope：`@xtai-notion`），替代原 monolith `@workspace/editor`：

| 包 | 职责 |
|----|------|
| [`@xtai-notion/editor-core`](./packages/editor-core) | Tiptap / Yjs 内核，无 React、无 UI |
| [`@xtai-notion/editor-react`](./packages/editor-react) | Provider、Hooks、协作、`ComponentsContext` |
| [`@xtai-notion/editor-shadcn`](./packages/editor-shadcn) | 默认 shadcn UI（`DocumentEditor` 等） |

- **开箱即用：** 安装 shadcn 包并引入 `@xtai-notion/editor-shadcn/style.css`
- **Headless：** 仅 core + react，通过 `ComponentsProvider` 注入自有 UI
- **兼容：** `@workspace/editor` 仍为 shim，标记 deprecated，后续变更将移除

变更规格见 [`openspec/changes/open-source-editor-sdk/`](./openspec/changes/open-source-editor-sdk/)。

校验包间依赖方向：

```bash
pnpm check:editor-boundaries
```
