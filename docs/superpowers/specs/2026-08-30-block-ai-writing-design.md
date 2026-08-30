# 块级 AI 写作设计

**日期：** 2026-08-30  
**状态：** 实施完成  
**实施计划：** [`docs/superpowers/plans/2026-08-30-block-ai-writing.md`](../plans/2026-08-30-block-ai-writing.md)

## 目标

在自研块编辑器里实现「AI 自动写作」：模型通过块级工具（插入 / 更新 / 删除）产出改动，用户在**本地草稿**里预览，点「接受」后才写入正式 `BlockEditor` 并进入 Yjs 协作。

第一期入口为斜杠 `/ai` 续写与选区改写。现有侧边栏 AI 助手保持只读问答，不改文档。

## 非目标

- 不引入 `@blocknote/xl-ai` 或 Vercel AI SDK；后端继续用现有 LangChain + OpenAI 兼容接口。
- 不让后端直接写 Yjs / Postgres 文档快照。
- 不生成或改写表格、图片、画板、分割线。
- 不做嵌套插入（`placement: "nested"`）、不做草稿内多轮续聊、不把 AI 光标画进正文。
- 不替换侧边栏 `/ai/chat` 的产品行为。
- 不在服务端排队同一文档的多路写作。

## 已确认的产品选择

| 项 | 选择 |
|----|------|
| 入口 | `/ai` 续写 + 选区改写；侧边栏聊天只读 |
| 确认 | 先预览，再接受 / 拒绝 |
| 协作可见性 | 预览仅本地；接受后才同步 Yjs |
| 可写块类型 | 段落、标题、列表、待办、引用、代码块 |

## 架构总览

```text
用户 /ai 或选区 AI
        │
        ▼
  apps/web  AiWritingSession
        │  1. 快照 live.document → 无 Yjs 影子 BlockEditor
        │  2. 精简块列表（id / type / 纯文本 / 选区 / 光标块）
        ▼
  POST /ai/write
        │
        ▼
  apps/api  AiWriteAgent（LangChain bindTools）
        ▼
  SSE: tool_call | done | error
        │
        ▼
  客户端对影子编辑器执行工具
        │
        ├─ 拒绝 → 销毁影子，live 不变
        └─ 接受 → 按会话 ops 重放到 live BlockEditor → Yjs
```

- 侧边栏继续走 `POST /ai/chat`。
- 写作走新接口 `POST /ai/write`，SSE 风格与聊天一致（`event:` + `data:` JSON）。
- 鉴权：已登录且对该文档 `assertCanRead`。正式写入仍只发生在客户端 live 编辑器；viewer 的 live 只读，接受会失败。

## 包边界

| 包 | 职责 |
|----|------|
| `editor-core` | 文本块集合、精简序列化、工具参数类型与校验、将 ops 应用到任意 `BlockEditor` |
| `editor-shadcn` | 斜杠「AI 写作」、选区工具栏 AI 按钮、提示条与草稿预览框 |
| `apps/web` | `AiWritingSession`：拉 SSE、维护影子实例、接受/拒绝、与协作文档绑定 |
| `apps/api` | `/ai/write`、限额、system prompt、把模型 tool call 编成 SSE |

`editor-core` 不依赖 React、不依赖 LangChain。API 与 Web 都只依赖 core 的块/ops 类型，避免两套 schema。

## 块与工具

### 文本块

```ts
const AI_WRITABLE_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
  "codeBlock",
] as const
```

精简文档节点（发给模型，控制 token）：

```ts
type AiBlockView = {
  id: string
  type: string
  text: string
  children: AiBlockView[]
}
```

`text` 由行内节点拼接纯文本；表格/图片/画板/分割线仍出现在树中（便于定位），但标记为不可写。模型不得对它们 `update` / `remove`。

### 工具

| 工具 | 参数 | 第一期约束 |
|------|------|------------|
| `insert_blocks` | `refId`, `placement: "before" \| "after"`, `blocks: { type, text, props? }[]` | 仅文本块；禁止 `nested` |
| `update_block` | `id`, `type?`, `text?`, `props?` | 目标必须是文本块 |
| `remove_blocks` | `ids: string[]` | 默认关闭；第一期两种模式都不启用删除，以免清空文档 |

`text` 在应用到 `BlockEditor` 时变成单段 `{ type: "text", text, styles: {} }`，不要求模型输出完整 `InlineContent[]`。新插入块的 `id` 由 core 生成；模型不必编 UUID。

影子执行成功的每次工具调用记入 `AiWriteOp[]`，接受时按同一顺序在 live 上重放。

### 模式

- `slash`：上下文为全文精简树 + `cursorBlockId`。允许 `insert_blocks` 与对当前空段落的 `update_block`。空段落 id 记为 `emptyCursorBlockToDelete`，**接受成功后**再从 live 删除。
- `selection`：上下文为全文精简树，选中 id 单独列出。只允许对选中文本块 `update_block`，以及在选区锚点 `insert_blocks`（after）。

同一文档、同一浏览器同时只允许一路 `AiWritingSession`。

## API

`POST /ai/write`

请求：

```ts
type AiWriteRequest = {
  documentId: string
  mode: "slash" | "selection"
  prompt: string
  cursorBlockId: string
  selectedIds: string[]
  blocks: AiBlockView[]
}
```

响应 SSE 事件：

- `{ type: "tool_call", op: AiWriteOp }` — 一次已通过服务端校验的工具调用（仍由客户端执行）
- `{ type: "done" }`
- `{ type: "error", message: string }`

服务端校验工具参数（类型、placement、id 是否出现在本次 `blocks` 快照中）。非法调用不发给客户端。若整次请求没有任何合法 `tool_call`，以 `error` 结束（「没有可应用的改动」），不把模型散文写入文档。

限额与现有聊天同量级：prompt、序列化文档、消息条数均设上限，超限 `400`。未配置 `OPENAI_*` 时 `503`。

System prompt 必须说明：只能用工具改文档、块 id 含义、不可写类型、slash 与 selection 各自允许的工具。

## UI

- `/` 菜单增加「AI 写作」。选中后关闭斜杠菜单，在当前块上方打开提示条（输入框 + 短命令：续写、列大纲、改口语）。
- 选区气泡工具栏增加 AI 按钮，同一提示条（润色、扩写、更简洁），上下文仅选中块。
- 提示条状态：`user-input` → `thinking` → `ai-writing` → `user-reviewing` | `error`。第一期 `user-reviewing` 只提供接受 / 拒绝 / 停止，不做草稿内第二轮对话。
- 草稿：用无协作、只读、无工具栏的编辑器实例，浮在光标块或选区下方。slash 只渲染新插入块；selection 只渲染被 update 的块。正文在接受前不改内容，选区可加高亮。草稿左侧 AI 色条。
- viewer、离线、协作未就绪：隐藏或禁用入口。
- 再触发时若已有会话，提示先接受或拒绝。

## 接受与拒绝

- **拒绝 / 取消**：销毁影子与草稿框，live 与 Yjs 不变。
- **停止**：中止 SSE；已应用到影子的 ops 保留，进入 `user-reviewing`，用户仍可接受或拒绝。
- **接受**：按 `AiWriteOp[]` 在 live `BlockEditor` 上重放。重放前检查每个涉及的 `refId` / `update id` 仍存在于 `live.document`。任一缺失则整次失败，草稿保留，提示「文档已变化，请拒绝后重试」。slash 在成功插入后再删除 `emptyCursorBlockToDelete`（若仍为空段落且仍存在）。
- 不把影子整棵 `document` 替换进 live，避免覆盖他人在预览期间的编辑。

## 失败与并发

- 未登录或不能读文档：不调用模型。
- 流中途断开：同停止，草稿可接受或拒绝，不自动写入 live。
- 预览期间远程变更不合并进影子。
- 非法 tool 在服务端丢弃；客户端对影子执行失败的 op 跳过并记 warning。零次成功 op → `error`。

## 测试与验收

### 测试

- `editor-core`：精简序列化、可写类型、校验、ops 应用到无协作 `BlockEditor`。
- `apps/api`：鉴权、超限、mock 模型下 SSE 编出合法/非法 tool_call。
- `apps/web`：接受才改 live；拒绝后 live 不变；id 丢失接受失败。不强制 Playwright 打真模型。

### 验收

1. `/ai` 续写：接受前 Yjs/正文不变，草稿可见文本块；接受后新块出现在光标后。
2. 选区改写：只更新选中文本块；表格/图片/画板不被改。
3. 拒绝后文档与打开 AI 前一致。
4. 侧边栏聊天行为不变。

## 实施顺序（计划阶段再拆任务）

1. core：`AiBlockView`、ops、校验、应用到 `BlockEditor`
2. API：`/ai/write` + LangChain tools
3. Web session + shadcn 入口与草稿 UI
4. 接受/拒绝与 id 冲突
5. 单测覆盖上述验收
