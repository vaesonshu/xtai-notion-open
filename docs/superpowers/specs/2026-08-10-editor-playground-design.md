# Editor Playground 测试页设计

日期：2026-08-10  
状态：已实现

## 目标

在 `apps/web` 增加独立路由 `/editor-playground`，方便手测当前 `@workspace/editor` 的本地编辑能力，并提供 JSON 调试面板。不改首页 Inkspace 演示，不接入协作后端。

## 范围

### 包含

- 路由：`apps/web/app/editor-playground/page.tsx`
- 客户端组件：`EditorPlayground`（同目录或同目录拆分文件）
- 工具：`formatEditorSnapshot(document)` → 可读 JSON 字符串
- 工具栏：粗体 / 斜体 / 下划线 / 删除线 / 行内代码、链接地址输入、撤销 / 重做
- Slash 调试区：查询输入 + `filterSlashCommands` 结果列表，点击执行 `executeSlashCommand`
- 调试面板：实时文档 JSON（`aria-label="编辑器 JSON 快照"`），可选展示选区是否为空
- 为 web 增加最小 Vitest + Testing Library 配置，覆盖工具函数与页面冒烟渲染
- 如 `@workspace/editor/styles.css` 缺失，补最小 ProseMirror 基础样式使编辑区可辨认

### 不包含

- 替换首页 / 产品壳（侧栏、正式工具栏）
- 协作、WebSocket、多光标、同步状态
- 正式 slash 浮层、气泡菜单、拖拽手柄 UI
- Playwright E2E

## 架构

```
/editor-playground (RSC page)
  └── EditorPlayground (client)
        ├── EditorProvider (onChange → snapshot state)
        │     └── 工具栏 + EditorContent + Slash 区 + JSON 面板
        └── formatEditorSnapshot (纯函数)
```

依赖：

- `@workspace/editor/react`：`EditorProvider`、`EditorContent`、`useEditorInstance`
- `@workspace/editor`：`toggleInlineMark`、`setEditorLink`、`filterSlashCommands`、`executeSlashCommand`
- `@workspace/ui` 基础组件（button、input 等），保持开发调试感，不追求产品视觉

初始内容：Provider 默认 `createInitialDocument()` / starter document，页面不硬编码正文。

## 布局

桌面：左编辑区 + 右 JSON；窄屏上下堆叠。

自上而下区块：

1. 标题「编辑器测试台」
2. 工具栏（格式化、链接、撤销/重做）
3. `EditorContent` 编辑区
4. Slash 查询与结果列表
5. JSON 快照面板

可访问性：关键控件使用可见文本或 `aria-label`（「链接地址」「Slash command 查询」「编辑器 JSON 快照」），与冒烟测试断言一致。

## 行为与错误处理

| 场景 | 行为 |
|------|------|
| 空链接提交 | `setEditorLink(editor, "")` → unset link |
| Slash 无匹配 | 显示空列表 |
| 命令执行失败 | 静默；不 toast |
| 文档更新 | `onChange` 刷新 JSON 快照 |

无网络依赖；无协作状态文案。

## 测试

1. `playground-utils.test.ts`：`formatEditorSnapshot` 对 `{ type: "doc", content: [] }` 输出缩进 JSON
2. `editor-playground.test.tsx`：渲染后可见标题、粗体、撤销、链接输入、slash 查询、JSON 含 `"type": "doc"`
3. 手测：`pnpm --filter web dev` → 打开 `http://localhost:3000/editor-playground`

实现顺序遵循 TDD：先写/落定失败测试，再写最小实现。

## 成功标准

- 浏览器可打开 `/editor-playground` 并编辑文本
- 工具栏与 slash 调试区能改变文档，JSON 面板同步更新
- 首页 `/` 行为不变
- 相关单元/冒烟测试通过
