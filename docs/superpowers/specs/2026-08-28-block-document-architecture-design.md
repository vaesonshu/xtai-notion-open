# 块文档架构设计

**日期：** 2026-08-28  
**状态：** 已确认，待实施计划执行

## 目标

把本项目做成 Notion / 飞书文档这一类产品：文档的对外单位是**块**，不是 Tiptap/ProseMirror JSON。第一期完成块数据模型、块结构的编辑器核心、两包分层，以及旧协作文档的一次性迁移。

学 [BlockNote](https://github.com/TypeCellOS/BlockNote) 的分层与块模型，不复制其源码。`learn-miaoma-docs` 是 BlockNote 源码级移植，本仓库不走那条路。

## 非目标

- 不实现多维数据库、看板、按块评论、块级权限、模板市场。
- 不把表格单元格做成可再嵌套块的迷你文档。
- 不发布编辑器 SDK，不拆第三包（没有第二套编辑器皮肤）。
- 不让新旧编辑器客户端混连同一协作房间。
- 不把 Block JSON 另存一份到 Postgres；协同仍只存 Yjs 快照与更新。

## 架构总览

```text
apps/web  ──►  @workspace/editor  ──►  @workspace/editor-core
apps/api  ──►  @workspace/editor-core

editor-core   无 React / 无 @tiptap/react / 无 @workspace/ui
editor        React 绑定 + 现有菜单/把手/节点视图
```

- 公共文档类型是 `Block[]`。
- 内部仍用 Tiptap 3 + Yjs + Hocuspocus。
- ProseMirror 树改为块容器结构；Yjs fragment 名称仍为 `default`。
- core 对外门面是 `BlockEditor`，Tiptap `Editor` 不进入 Web 公共 API。

## 块模型

```ts
type Block = {
  id: string
  type: BlockType
  props: Record<string, unknown>
  content?: InlineContent[] | TableContent
  children: Block[]
}

type InlineContent =
  | { type: "text"; text: string; styles: InlineStyles }
  | { type: "link"; href: string; content: InlineContent[] }
  | { type: "mention"; id: string; label: string; href: string }

type InlineStyles = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
}
```

`id` 为 UUID。新建块时生成；迁移旧文档时为每一块补上。

文档至少包含一块空段落。编辑器末尾保留一块可聚焦的空段落，避免光标无处可放。

## 内部文档树

```text
doc
└─ blockGroup
   └─ blockContainer+          // 一块一个容器，属性含 id
      ├─ blockContent          // paragraph / heading / image …
      └─ blockGroup?           // 仅当 children 非空
```

这是 BlockNote 的文档形状，节点实现自写。`blockContainer` 带稳定 `id`，协同与块操作都针对该 id。

## 第一期块类型

| 块 | `type` | content | props / 说明 |
|---|---|---|---|
| 段落 | `paragraph` | 行内 | 默认块 |
| 标题 | `heading` | 行内 | `level`: 1 \| 2 \| 3 |
| 无序/有序/待办 | `bulletListItem` / `numberedListItem` / `checkListItem` | 行内 | 每条是一块；待办有 `checked`；有序号按同级兄弟计算，不写入 props |
| 引用 | `quote` | 行内 | 旧 `blockquote` 压成一块 |
| 代码 | `codeBlock` | 无样式纯文本行内 | `language` 可空 |
| 分隔线 | `divider` | 无 | 不可输入 |
| 图片 | `image` | 无 | 合并现有 `image` 与 `imageUpload`；`src`、`uploadStatus`: `idle` \| `uploading` \| `error` |
| 表格 | `table` | `TableContent` | 单元格只含行内，不允许再嵌套块 |
| 画板 | `canvas` | 无 | `canvasId`、`snapshot` 进入 props |

提及、链接、粗斜体等是行内，不是块。

分隔线、图片、画板、表格不能在块内容里输入，但**可以有 `children`**（例如图片下缩进一段）。

### 表格内容

```ts
type TableContent = {
  headerRows: number
  rows: { cells: { content: InlineContent[] }[] }[]
}
```

`children` 不表示单元格。单元格内粘贴整块时压成行内文本。

## 缩进与拖拽

- **Tab**：当前块成为「上一个同级块」的最后一个 child；没有上一个同级则忽略。
- **Shift+Tab**：当前块连同 children 升到与父块同级，插在父块之后。
- **最大深度 8**。
- **拖拽把手**：移动整个 `blockContainer`（含嵌套）。打开 nested；旧设计因 StarterKit 列表而关闭 nested，块树下不再适用。
- **斜杠 `/`**：当前块为空时是「变成该类型」；有内容时是「在下方插入」。
- 斜杠与工具栏改块类型，一律走 `updateBlock` / `insertBlocks`，不直接 `chain().setNode()`。

## 包边界

当前 `packages/editor` 拆成：

- `packages/editor-core` → `@workspace/editor-core`（现有 `src/core` + `src/collaboration` + Yjs 转换）
- `packages/editor` → `@workspace/editor`（现有 `src/react` + `src/components` + 样式）

`apps/web` 只依赖 `@workspace/editor`。禁止再 `import "@workspace/editor/core"`（例如 `fixed-toolbar` 里的 `insertTable`）。

`apps/api` 只依赖 `@workspace/editor-core`。

用测试钉死：`packages/editor-core` 源码不得出现 `from "react"`、`@tiptap/react`、`@workspace/ui`。

React 节点视图保持现状：core 注册无 UI 的 Node；`@workspace/editor` 注入图片上传、画板的 NodeView。

## `BlockEditor` API（core）

```ts
editor.document: Block[]
editor.insertBlocks(blocks, refId, "before" | "after" | "nested")
editor.updateBlock(id, { type?, props?, content? })
editor.removeBlocks(ids)
editor.nestBlock() / editor.unnestBlock()
editor.getSelectedBlocks()
editor.onChange((blocks: Block[]) => void)
```

保留并改签名：

| 符号 | 变化 |
|---|---|
| `documentFromYjs` | 返回 `Block[]` |
| `documentToPlainText` | 入参为 `Block[]` |
| `collectMentionIds` | 扫描行内 `mention` |
| `createCollaborationSession` | 仍在 core，无 React |

旧 schema 迁移函数不进主入口。服务端通过 `@workspace/editor-core/migrate` 引用，Web 不得使用。

删除公共导出：`EditorDocument`、Tiptap `JSONContent` 作为文档类型、`export type Editor from "@tiptap/core"`。

## React 包 API

现有入口保留，文档类型改为块：

- `EditorProvider` / `CollaborationEditorProvider`：`initialContent?: Block[]`，`onChange?: (blocks: Block[]) => void`
- `DocumentEditor`：协作、只读、提及注入的页面入口
- 斜杠菜单、浮动工具栏、拖拽把手、提及、表格菜单、图片、画板

Web 工具栏通过 `useBlockEditor()` 调用 `updateBlock` / `insertBlocks`，不拿 Tiptap 实例。

## 数据流

**本地（playground）**

```text
Block[] → EditorProvider 创建 BlockEditor
  → 用户输入 → PM transaction
  → nodeToBlock → onChange(Block[])
```

**协作（文档页）**

```text
documentId + token
  → createCollaborationSession（Y.Doc + Hocuspocus）
  → 等首次 synced（先同步再创建编辑器，避免本地种子覆盖远端）
  → API onLoad：必要时 v1→v2 迁移并立刻打快照
  → 仅当远端 fragment 为空时写入默认块
  → Collaboration 绑定同一 fragment
  → 光标与画板锁仍走 awareness
```

**服务端读（摘要、提及图、广场）**

```text
Yjs 快照 + 更新 → Y.Doc → documentFromYjs(): Block[]
  → collectMentionIds / documentToPlainText / 只读 DocumentEditor
```

## 旧文档迁移

换 schema 后旧 Y.XmlFragment 无法被新节点解析，必须显式迁移。

1. `Document.schemaVersion`：整数，默认 `1`（当前 StarterKit 流式树），`2` 为块树。Y.Doc 内同步写入 `meta.schemaVersion`。
2. `onLoadDocument` 按 `documentId` 加锁：
   - 已是 `2`：原样加载。
   - `1` 或空：用**保留的旧 extensions** 将 Y.Doc → 旧 Tiptap JSON → `Block[]`（补 UUID）→ 新 PM 文档 → 新 Y.Doc；立刻持久化快照并将 version 写成 `2`。
3. 转换规则：
   - `paragraph` / `heading` / `codeBlock` / `horizontalRule` / `image` / `canvasBlock` → 对应块（`horizontalRule` → `divider`，`canvasBlock` → `canvas`）。
   - `bulletList` / `orderedList` / `taskList`：每个 list item 变一块；嵌套列表变为 `children`。
   - `blockquote`：第一段作为 `quote` 行内，其余内部块成为该 quote 的 `children`。
   - `table`：整表一块，单元格行内保留。
   - `mention`：行内 `mention`，`id` / `label` / `href` 不变。
   - `imageUpload`：`image` 且 `uploadStatus` 为 `idle`（无 src）。
4. 空文档与种子文档直接用块树创建。
5. 一次发布全员新客户端。不做双版本编辑器协议。

## 失败处理

| 情况 | 行为 |
|---|---|
| 迁移抛错 | 不写 `schemaVersion=2`，旧字节保留；客户端显示现有不可恢复错误，不得标为已保存 |
| 多人同时进房 | `onLoad` 按文档加锁，只迁一次 |
| 未知 `type` | 降级为段落（能保留的行内则保留），整篇仍可打开 |
| Tab 已到深度 8 / 无上一个同级 | 无操作 |
| 单元格粘贴整块 | 压成行内文本 |
| 协同断开 / 未授权 | 沿用 connecting / offline / unauthorized / error |
| 新客户端遇到尚未迁移的 v1 | 服务端先迁再同步 v2 |

## 测试

**core**

- `Block[]` ↔ PM 往返：段落、标题、三种列表嵌套、引用、代码、图片、表格、画板、提及。
- 旧 Tiptap JSON fixture → `Block[]`：嵌套列表、多段 blockquote、表格、canvas、mention。
- `insertBlocks` / `updateBlock` / `nestBlock` / `unnestBlock`。
- `collectMentionIds`、纯文本。
- editor-core 不得依赖 React 的静态检查。

**API**

- v1 Y.Doc fixture 经 `onLoad` 后 `schemaVersion=2`，再次 load 不再迁移。
- 迁移失败时 version 仍为 1，快照未被替换。

**React / e2e**

- 空块 `/` 为变成；有内容的 `/` 为下方插入。
- Tab 缩进后拖拽，子块跟随。
- 两会话改不同块仍同步（现有协作 e2e 改走块 schema）。

## 实施顺序

1. 在现有包内落地块类型、PM 节点、`Block[]` ↔ Node、旧 JSON 转换（测试先于实现）。
2. `BlockEditor` 门面替换对 Tiptap JSON 的公共依赖；斜杠/工具栏改走块命令。
3. 拆出 `@workspace/editor-core`，修正 Web/API 导入。
4. `schemaVersion` + `onLoad` 迁移；更新种子与 playground。
5. 打开 nested 拖拽与 Tab 缩进；补 e2e。

先改模型再拆包，避免围着即将废弃的 `EditorDocument` 迁两次导入。
