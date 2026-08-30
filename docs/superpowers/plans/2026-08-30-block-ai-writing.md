# 块级 AI 写作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在自研块编辑器中实现 `/ai` 续写与选区改写：模型输出块级工具调用，本地影子预览，用户接受后才写入 live `BlockEditor` / Yjs。

**Architecture:** `editor-core` 提供精简块视图、工具校验与 ops 应用到任意 `BlockEditor`。`apps/api` 新增 `POST /ai/write`（LangChain bindTools + SSE），不写 Yjs。`editor-shadcn` 提供斜杠/气泡入口与草稿 UI。`apps/web` 的 `AiWritingSession` 维护无协作影子编辑器，接受时重放 ops。

**Tech Stack:** BlockEditor / `Block[]`、NestJS SSE、LangChain `@langchain/openai`（已有，不引入 Vercel AI SDK / `@blocknote/xl-ai`）、Vitest、Testing Library、Next.js 16。

**Spec:** [`docs/superpowers/specs/2026-08-30-block-ai-writing-design.md`](../specs/2026-08-30-block-ai-writing-design.md)

## Global Constraints

- 不引入 `@blocknote/xl-ai` 或 Vercel AI SDK；不让后端写 Yjs / Postgres 文档快照。
- 第一期不生成/改写 `table` | `image` | `canvas` | `divider`；禁止 `placement: "nested"`；不开放 `remove_blocks`。
- 侧边栏 `POST /ai/chat` 行为保持只读，本计划不得改其系统提示词语义。
- 同一文档同一浏览器同时只允许一路写作会话；viewer / 离线 / 未同步时禁用入口。
- API 从 `@xtai-notion/editor-core/server` 导入校验与类型，禁止从包根导入以免拉 Excalidraw。
- 根目录 `.prettierrc`：LF、双引号、两空格、无分号、80 列；新增代码带有用中文注释。
- 每个新增/实质修改代码块至少一句解释意图的注释。
- 实现 Next.js 相关代码前核对该功能涉及的 `node_modules/next/dist/docs/` 指南。

## File map

| 文件 | 职责 |
|------|------|
| `packages/editor-core/src/core/ai-write/types.ts` | `AiBlockView`、`AiWriteOp`、`AiWriteMode`、可写类型常量 |
| `packages/editor-core/src/core/ai-write/serialize.ts` | `Block[]` → `AiBlockView[]`、收集 id、空段落判断 |
| `packages/editor-core/src/core/ai-write/validate.ts` | 按 mode 校验 op（无 React / 无 BlockEditor） |
| `packages/editor-core/src/core/ai-write/apply.ts` | 把 op 应用到 `BlockEditor`；`canReplayAiWriteOps` |
| `packages/editor-core/src/core/ai-write/index.ts` | 聚合导出 |
| `packages/editor-core/src/core/index.ts` | 从包根导出 ai-write |
| `packages/editor-core/src/server.ts` | 仅导出 types / serialize / validate |
| `apps/api/src/ai/ai.types.ts` | 扩展 `AiWriteRequest` / `AiWriteStreamEvent` |
| `apps/api/src/ai/ai-write.agent.ts` | LangChain tools → 校验后的 `AiWriteOp` 流 |
| `apps/api/src/ai/ai.service.ts` | `write()`：鉴权、限额、委托 agent |
| `apps/api/src/ai/ai.controller.ts` | `POST /ai/write` SSE |
| `apps/web/lib/ai-writing/session.ts` | 影子编辑器、apply/accept/reject |
| `apps/web/lib/ai-writing/client.ts` | fetch SSE |
| `packages/editor-shadcn/src/components/ai/ai-write-context.tsx` | 入口回调 context |
| `packages/editor-shadcn/src/components/ai/ai-write-prompt-bar.tsx` | 提示条 + 接受/拒绝 |
| `packages/editor-shadcn/src/components/ai/ai-write-draft.tsx` | 无协作草稿预览 |
| `packages/editor-shadcn/src/components/menus/slash-menu.tsx` | `/ai` 项 |
| `packages/editor-shadcn/src/components/menus/bubble-toolbar.tsx` | AI 按钮 |
| `apps/web/components/inkspace/ai-writing-host.tsx` | 会话 + UI 接到工作区 |

---

### Task 1: core 精简视图与工具校验

**Files:**
- Create: `packages/editor-core/src/core/ai-write/types.ts`
- Create: `packages/editor-core/src/core/ai-write/serialize.ts`
- Create: `packages/editor-core/src/core/ai-write/validate.ts`
- Create: `packages/editor-core/src/core/ai-write/index.ts`
- Modify: `packages/editor-core/src/core/index.ts`（导出 ai-write）
- Modify: `packages/editor-core/src/server.ts`（导出 types/serialize/validate，不要导出 apply）
- Test: `packages/editor-core/test/core/ai-write-validate.test.ts`

**Interfaces:**
- Consumes: `Block`、`BlockType`、`InlineContent`
- Produces:

```ts
export const AI_WRITABLE_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
  "codeBlock",
] as const

export type AiWritableBlockType = (typeof AI_WRITABLE_BLOCK_TYPES)[number]
export type AiWriteMode = "slash" | "selection"

export type AiBlockView = {
  id: string
  type: string
  text: string
  writable: boolean
  children: AiBlockView[]
}

export type AiInsertBlockInput = {
  type: AiWritableBlockType
  text: string
  props?: Record<string, unknown>
  id?: string
}

export type AiWriteOp =
  | {
      type: "insert_blocks"
      refId: string
      placement: "before" | "after"
      blocks: AiInsertBlockInput[]
    }
  | {
      type: "update_block"
      id: string
      type?: AiWritableBlockType
      text?: string
      props?: Record<string, unknown>
    }

export type AiWriteValidationContext = {
  mode: AiWriteMode
  cursorBlockId: string
  selectedIds: string[]
  snapshotIds: Set<string>
}

export function isAiWritableBlockType(type: string): type is AiWritableBlockType
export function blocksToAiBlockViews(blocks: Block[]): AiBlockView[]
export function collectAiBlockIds(views: AiBlockView[]): Set<string>
export function isEmptyTextBlock(block: Block): boolean
export function validateAiWriteOp(
  op: unknown,
  context: AiWriteValidationContext
): { ok: true; op: AiWriteOp } | { ok: false; reason: string }
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import {
  blocksToAiBlockViews,
  collectAiBlockIds,
  isEmptyTextBlock,
  validateAiWriteOp,
} from "@core/ai-write"

const para = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  type: "paragraph" as const,
  props: {},
  content: [{ type: "text" as const, text: "hello", styles: {} }],
  children: [],
}

describe("ai-write serialize/validate", () => {
  it("marks image blocks not writable and concatenates text", () => {
    const views = blocksToAiBlockViews([
      para,
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        type: "image",
        props: {},
        children: [],
      },
    ])
    expect(views[0]?.writable).toBe(true)
    expect(views[0]?.text).toBe("hello")
    expect(views[1]?.writable).toBe(false)
  })

  it("rejects nested placement, remove ops, and updating image ids", () => {
    const snapshotIds = collectAiBlockIds(blocksToAiBlockViews([para]))
    const context = {
      mode: "slash" as const,
      cursorBlockId: para.id,
      selectedIds: [],
      snapshotIds,
    }
    expect(
      validateAiWriteOp(
        { type: "remove_blocks", ids: [para.id] },
        context
      ).ok
    ).toBe(false)
    expect(
      validateAiWriteOp(
        {
          type: "insert_blocks",
          refId: para.id,
          placement: "nested",
          blocks: [{ type: "paragraph", text: "x" }],
        },
        context
      ).ok
    ).toBe(false)
  })

  it("allows slash insert after cursor and selection update only on selected ids", () => {
    const snapshotIds = new Set([para.id, "sel"])
    expect(
      validateAiWriteOp(
        {
          type: "insert_blocks",
          refId: para.id,
          placement: "after",
          blocks: [{ type: "heading", text: "Title", props: { level: 2 } }],
        },
        {
          mode: "slash",
          cursorBlockId: para.id,
          selectedIds: [],
          snapshotIds,
        }
      ).ok
    ).toBe(true)
    expect(
      validateAiWriteOp(
        { type: "update_block", id: para.id, text: "nope" },
        {
          mode: "selection",
          cursorBlockId: para.id,
          selectedIds: ["sel"],
          snapshotIds,
        }
      ).ok
    ).toBe(false)
  })

  it("treats whitespace-only paragraph as empty", () => {
    expect(
      isEmptyTextBlock({
        ...para,
        content: [{ type: "text", text: "  ", styles: {} }],
      })
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write-validate.test.ts`

Expected: FAIL（模块不存在）

- [ ] **Step 3: Write minimal implementation**

- `serialize.ts`：递归 `Block[]`；`text` 只拼接 `type === "text"` 的 `text` 与 mention 的 `label`；`writable = isAiWritableBlockType(type)`。
- `validate.ts`：未知 `type` 失败；`insert_blocks` 要求 `placement` 为 before/after、`refId` 在 `snapshotIds`、每块 `isAiWritableBlockType` 且 `text` 为 string；slash 的 `update_block` 仅允许 `id === cursorBlockId`；selection 的 `update_block` 仅允许 `selectedIds.includes(id)`，`insert_blocks.refId` 必须属于 `selectedIds`（若 `selectedIds` 为空则失败）。
- `index.ts` 导出；`core/index.ts` 与 `server.ts` 按上表导出。`server.ts` 不得 import `apply.ts` / `BlockEditor`。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write-validate.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor-core/src/core/ai-write packages/editor-core/src/core/index.ts packages/editor-core/src/server.ts packages/editor-core/test/core/ai-write-validate.test.ts
git commit -m "feat(editor-core): add AI write block views and op validation"
```

---

### Task 2: 把 ops 应用到 BlockEditor

**Files:**
- Create: `packages/editor-core/src/core/ai-write/apply.ts`
- Modify: `packages/editor-core/src/core/ai-write/index.ts`
- Test: `packages/editor-core/test/core/ai-write-apply.test.ts`

**Interfaces:**
- Consumes: `validateAiWriteOp`、`BlockEditor.insertBlocks` / `updateBlock` / `removeBlocks`、`generateBlockId`
- Produces:

```ts
export function textToInlineContent(text: string): InlineContent[]
export function applyAiWriteOp(
  editor: BlockEditor,
  op: AiWriteOp
): { ok: true; op: AiWriteOp } | { ok: false; reason: string }
export function collectAiWriteOpTargetIds(ops: AiWriteOp[]): string[]
export function canReplayAiWriteOps(
  live: BlockEditor,
  ops: AiWriteOp[]
): boolean
export function extractDraftBlocks(
  shadow: BlockEditor,
  ops: AiWriteOp[]
): Block[]
```

`applyAiWriteOp`：insert 时若块无 `id` 则 `generateBlockId()`，写入后返回带 id 的 op。`update_block` 用 `textToInlineContent` 生成单段 unstyled text；未传 `text` 则不改 content。目标 id 不存在则 `{ ok: false }`。`canReplayAiWriteOps`：每个 insert 的 `refId` 与每个 update 的 `id` 必须仍在 `live.document` 树中。`extractDraftBlocks`：insert 产生的 id + update 的 id，按影子 `document` 前序收集对应块（含子树）。

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/block-editor"
import {
  applyAiWriteOp,
  canReplayAiWriteOps,
  extractDraftBlocks,
} from "@core/ai-write"

const editors: BlockEditor[] = []
function create() {
  const editor = new BlockEditor({
    initialContent: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "one", styles: {} }],
        children: [],
      },
    ],
  })
  editors.push(editor)
  return editor
}
afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("applyAiWriteOp", () => {
  it("inserts after ref and records generated ids", () => {
    const editor = create()
    const result = applyAiWriteOp(editor, {
      type: "insert_blocks",
      refId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      placement: "after",
      blocks: [{ type: "paragraph", text: "two" }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.op.type).toBe("insert_blocks")
      expect(editor.document).toHaveLength(2)
      expect(editor.document[1]?.content).toEqual([
        { type: "text", text: "two", styles: {} },
      ])
    }
  })

  it("refuses replay when ref id disappeared", () => {
    const live = create()
    const ops = [
      {
        type: "insert_blocks" as const,
        refId: "missing",
        placement: "after" as const,
        blocks: [{ type: "paragraph" as const, text: "x", id: "x" }],
      },
    ]
    expect(canReplayAiWriteOps(live, ops)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write-apply.test.ts`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation in `apply.ts`；从 `index.ts` 导出。查找块 id 用递归扫描 `editor.document`。**

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor-core/src/core/ai-write packages/editor-core/test/core/ai-write-apply.test.ts
git commit -m "feat(editor-core): apply AI write ops on BlockEditor"
```

---

### Task 3: API 写作契约与 Agent

**Files:**
- Modify: `apps/api/src/ai/ai.types.ts`
- Create: `apps/api/src/ai/ai-write.agent.ts`
- Test: `apps/api/test/ai/ai-write.agent.spec.ts`

**Interfaces:**
- Consumes: `validateAiWriteOp`、`AiBlockView`、`AiWriteOp` from `@xtai-notion/editor-core/server`
- Produces:

```ts
export type AiWriteRequest = {
  documentId: string
  mode: "slash" | "selection"
  prompt: string
  cursorBlockId: string
  selectedIds: string[]
  blocks: AiBlockView[]
}

export type AiWriteStreamEvent =
  | { type: "tool_call"; op: AiWriteOp }
  | { type: "done" }
  | { type: "error"; message: string }

export function isAiWriteRequest(value: unknown): value is AiWriteRequest

export class AiWriteAgent {
  constructor(environment: Environment, runner?: AiWriteToolRunner)
  stream(
    request: AiWriteRequest,
    signal?: AbortSignal
  ): AsyncIterable<AiWriteOp>
}

export type AiWriteToolRunner = (input: {
  request: AiWriteRequest
  signal?: AbortSignal
}) => AsyncIterable<unknown>
```

默认 runner：`ChatOpenAI` + `bindTools` 两个 tool（`insert_blocks`、`update_block`），system prompt 用中文说明只能调工具、slash/selection 规则、不可写类型。将每个完整 tool call 的 `args` 交给 `validateAiWriteOp`；非法则跳过。未配置 `OPENAI_*` 抛出与聊天相同的 `ServiceUnavailableException`（"AI 服务未配置"）。

测试用注入 `runner` yield 原始对象，不打真实网络。

- [ ] **Step 1: Write the failing test** — 合法 insert yield 为 `AiWriteOp`；`placement: "nested"` 被丢掉；空 runner 不 yield。

- [ ] **Step 2: Run** `pnpm --filter api test -- test/ai/ai-write.agent.spec.ts` Expected: FAIL

- [ ] **Step 3: Implement types + agent。tool schema 用普通 JSON object（不必新加 zod）。system prompt 必须包含「不得输出散文代替工具」。**

- [ ] **Step 4: Run agent spec + `pnpm --filter api typecheck`** Expected: PASS

- [ ] **Step 5: Commit** `feat(api): add LangChain AI write agent with block tools`

---

### Task 4: `POST /ai/write` 服务与 SSE

**Files:**
- Modify: `apps/api/src/ai/ai.service.ts`
- Modify: `apps/api/src/ai/ai.controller.ts`
- Modify: `apps/api/src/ai/ai.module.ts`
- Modify: `apps/api/src/ai/ai.types.ts`（`AI_LIMITS` 可复用并增加 `prompt` / `blocksJson`）
- Test: `apps/api/test/ai/ai.service.spec.ts`（追加 write 用例）
- Test: `apps/api/test/ai/ai.controller.spec.ts`（若无则创建，覆盖 write SSE）

**Interfaces:**
- Consumes: `AiWriteAgent.stream`、`DocumentsService.assertCanRead`
- Produces:

```ts
// AiService
write(
  request: AiWriteRequest,
  userId: string,
  signal?: AbortSignal
): AsyncIterable<AiWriteStreamEvent>

// AiController
@Post("write")  // 与 chat 相同 guard、SSE 头、abort on close
```

限额：`prompt` 最长 10_000；`JSON.stringify(blocks)` 最长 100_000；`selectedIds.length` ≤ 200；空 `documentId` / 空 `prompt` / 非法 mode → `BadRequestException`。零次合法 tool_call 时 yield `{ type: "error", message: "没有可应用的改动" }`，不 yield `done`。有至少一次 `tool_call` 则最后 `done`。聊天 `chat()` 测试必须仍然通过。

- [ ] **Step 1: Write failing tests** — `assertCanRead` 在 write 前调用；超限 400；agent 空流 → error 事件；agent 一次 insert → `tool_call` + `done`。

- [ ] **Step 2: Run** `pnpm --filter api test -- test/ai/` Expected: 新用例 FAIL

- [ ] **Step 3: Implement `write` + controller 路由。注入 `AiWriteAgent`。**

- [ ] **Step 4: Run** `pnpm --filter api test -- test/ai/` 与 typecheck Expected: PASS

- [ ] **Step 5: Commit** `feat(api): stream AI write tool calls over SSE`

---

### Task 5: Web 会话（影子编辑器、接受/拒绝）

**Files:**
- Create: `apps/web/lib/ai-writing/session.ts`
- Create: `apps/web/lib/ai-writing/client.ts`
- Test: `apps/web/test/lib/ai-writing/session.test.ts`

**Interfaces:**
- Consumes: `BlockEditor`、`applyAiWriteOp`、`canReplayAiWriteOps`、`extractDraftBlocks`、`isEmptyTextBlock`
- Produces:

```ts
export type AiWritingStatus =
  | "user-input"
  | "thinking"
  | "ai-writing"
  | "user-reviewing"
  | "error"
  | "closed"

export function createAiWritingSession(input: {
  live: BlockEditor
  mode: AiWriteMode
  cursorBlockId: string
  selectedIds: string[]
}): AiWritingSession

export type AiWritingSession = {
  readonly mode: AiWriteMode
  readonly emptyCursorBlockToDelete: string | undefined
  status: AiWritingStatus
  errorMessage?: string
  ops: AiWriteOp[]
  shadow: BlockEditor
  applyRemoteOp(op: AiWriteOp): void
  draftBlocks(): Block[]
  accept(): { ok: true } | { ok: false; reason: "stale" | "empty" }
  reject(): void
  stop(): void
}

export async function* readAiWriteSse(
  response: Response
): AsyncGenerator<AiWriteStreamEvent>
```

`createAiWritingSession`：用 `live.document` 深拷贝（`structuredClone`）建 `new BlockEditor({ initialContent, editable: false })`。slash 且 `isEmptyTextBlock` 当前 cursor 块时设置 `emptyCursorBlockToDelete`。`applyRemoteOp` 应用到 shadow，成功则 push 到 `ops`，`status = "ai-writing"`。`accept`：`ops.length === 0` → `empty`；`!canReplayAiWriteOps(live, ops)` → `stale`；否则按序 `applyAiWriteOp(live, op)`，成功后若 `emptyCursorBlockToDelete` 仍存在且仍为空则 `live.removeBlocks([id])`，然后 `shadow.destroy()`，`status = "closed"`。`reject` 只 `shadow.destroy()`，不改 live。

`readAiWriteSse` 解析 `event:` / `data:` 行，与 `ai-assistant-panel` 相同风格。

- [ ] **Step 1: Failing tests** — apply insert 后 live 仍 1 块；accept 后 live 2 块；reject 后 live 1 块；把 live 的 ref 删掉再 accept 得 `stale` 且 live 不再变。

- [ ] **Step 2: Run** `pnpm --filter web test -- test/lib/ai-writing/session.test.ts` Expected: FAIL

- [ ] **Step 3: Implement session + SSE parser。测试结束必须 `session.reject()` 或 `destroy` 以免泄漏 Tiptap。**

- [ ] **Step 4: Run web session tests Expected: PASS**

- [ ] **Step 5: Commit** `feat(web): add local AI writing session with accept/reject`

---

### Task 6: shadcn 入口（斜杠、气泡、提示条、草稿）

**Files:**
- Create: `packages/editor-shadcn/src/components/ai/ai-write-context.tsx`
- Create: `packages/editor-shadcn/src/components/ai/ai-write-prompt-bar.tsx`
- Create: `packages/editor-shadcn/src/components/ai/ai-write-draft.tsx`
- Modify: `packages/editor-core/src/core/slash-commands/index.ts`（增加 `AI_WRITE_SLASH_COMMAND`）
- Modify: `packages/editor-shadcn/src/components/menus/slash-menu.tsx`
- Modify: `packages/editor-shadcn/src/components/menus/bubble-toolbar.tsx`
- Modify: `packages/editor-shadcn/src/index.ts`
- Test: `packages/editor-shadcn/test/components/menus/slash-menu.test.tsx`（追加）
- Test: `packages/editor-shadcn/test/components/menus/bubble-toolbar.test.tsx`（追加）
- Test: `packages/editor-shadcn/test/components/ai/ai-write-prompt-bar.test.tsx`

**Interfaces:**
- Consumes: `getSlashCommands`、`DocumentEditor`（`content` 模式）
- Produces:

```ts
export const AI_WRITE_SLASH_COMMAND: SlashCommand = {
  id: "ai-write",
  label: "AI 写作",
  keywords: ["ai", "写作", "续写"],
}

export type AiWriteHostHandlers = {
  openSlash: () => void
  openSelection: () => void
}

export const AiWriteHostContext = createContext<AiWriteHostHandlers | null>(null)

export function AiWritePromptBar(props: {
  status: AiWritingStatus
  errorMessage?: string
  onSubmit: (prompt: string) => void
  onAccept: () => void
  onReject: () => void
  onStop: () => void
  presets: { id: string; label: string; prompt: string }[]
}): JSX.Element

export function AiWriteDraft(props: { blocks: Block[] }): JSX.Element
```

斜杠：`getSlashCommands` 始终包含 `AI_WRITE_SLASH_COMMAND`（或 `includeAiWrite` 默认 true）。选中该项时：`exitSuggestion`，**不要** `executeSlashCommand`；若 context 为 null 则 no-op。气泡：context 非空时在 mark 按钮旁加 `data-testid="ai-write-toolbar-button"`，点击 `openSelection`。提示条：`user-input` 显示 textarea + presets；`thinking`/`ai-writing` 显示停止；`user-reviewing` 显示接受/拒绝；`error` 显示 `errorMessage` + 拒绝。slash presets：续写、列大纲、改口语；selection presets：润色、扩写、更简洁。草稿：`DocumentEditor content={blocks} editable={false}`，外层 `data-testid="ai-write-draft"` + 左侧色条（如 `border-l-2 border-[#8bc6ff]`）。

- [ ] **Step 1: Failing tests** — 输入 `/` 可见「AI 写作」；有 Provider 时点击调用 `openSlash`；无 Provider 时点击不抛错。气泡在有 Provider 时出现 AI 按钮。PromptBar reviewing 点击接受调用 `onAccept`。

- [ ] **Step 2: Run** `pnpm --filter @xtai-notion/editor-shadcn test -- slash-menu bubble-toolbar ai-write` Expected: FAIL

- [ ] **Step 3: Implement。`executeSlashCommand` 对未知 `ai-write` id 保持安全（若仍被调用应 no-op）。**

- [ ] **Step 4: Run shadcn tests Expected: PASS**

- [ ] **Step 5: Commit** `feat(editor-shadcn): add AI write slash, toolbar, and draft UI`

---

### Task 7: 接到文档工作区

**Files:**
- Create: `apps/web/components/inkspace/ai-writing-host.tsx`
- Modify: `apps/web/components/inkspace/document-workspace.tsx`
- Modify: `packages/editor-react` 仅当需要从 context 取出 `blockEditor`（优先用现有 `useBlockEditor`）
- Test: `apps/web/test/components/inkspace/ai-writing-host.test.tsx`
- Test: `apps/web/test/components/inkspace/ai-assistant-panel.test.tsx`（确认仍只打 `/ai/chat`）

**Interfaces:**
- Consumes: Task 5 session、Task 4 `POST /ai/write`、Task 6 UI
- Produces: `AiWritingHost` 包住 `DocumentEditor`：`role` 为 owner/editor 且协作已连接时提供 `AiWriteHostContext`；viewer 不提供。打开 slash：`mode=slash`，`cursorBlockId = live.getSelectedBlocks()[0]?.id ?? live.document[0].id`。打开 selection：`selectedIds = live.getSelectedBlocks().map(b => b.id)`，空选则不打开。提交：`status=thinking`，`fetch` `${apiUrl}/ai/write`，headers 与聊天相同（`x-dev-user-id`），body 为 `AiWriteRequest`（`blocks: blocksToAiBlockViews(live.document)`）。读取 SSE：`tool_call` → `applyRemoteOp`；`done` → `user-reviewing`；`error` → `error`。同一时刻已有未 closed 的 session 则 toast「请先接受或拒绝当前 AI 草稿」。

`AiWriteDraft` 与 `AiWritePromptBar` 用 portal 锚在编辑器表面下方（第一期可用 `position: fixed` + `data-testid`，不必完美跟随滚动）。

不要改 `AiAssistantPanel` 的请求 URL。

- [ ] **Step 1: Failing test** — mock `fetch` 返回一条 insert 的 SSE：host 在 accept 前不调用 `live.insertBlocks`（用 spy 或比较 `live.document` 长度）；accept 后长度增加。第二条：viewer 不渲染 `ai-write-toolbar-button`。第三条：assistant panel 仍请求 `/ai/chat`。

- [ ] **Step 2: Run web tests Expected: FAIL**

- [ ] **Step 3: Wire host。协作 `status !== "synced"` 时 context 为 null。实现前阅读 Next fetch 相关 docs 如有 Route Handler 变更；本任务只用浏览器 `fetch` 打 Nest。**

- [ ] **Step 4: Run** `pnpm --filter web test -- ai-writing ai-assistant-panel document-workspace` 与 `pnpm check:editor-boundaries` Expected: PASS

- [ ] **Step 5: Commit** `feat(web): attach in-editor AI writing to the document workspace`

---

### Task 8: 文档与验收扫尾

**Files:**
- Modify: `README.md`（产品能力表「AI 助手」一行：补充斜杠/选区写作，接受后才同步）
- Modify: `docs/superpowers/specs/2026-08-30-block-ai-writing-design.md` 状态改为「实施中」或保持，并链到本 plan
- Test: 回归 `pnpm --filter @xtai-notion/editor-core test -- test/core/ai-write`、`pnpm --filter api test -- test/ai`、`pnpm --filter web test -- ai`

- [ ] **Step 1: 更新 README 一句，避免暗示 AI 只能聊天。**
- [ ] **Step 2: 跑上述测试套件，确认聊天与写作测试都过。**
- [ ] **Step 3: Commit** `docs: mention in-editor AI writing in README`

**手动验收（不写入 CI）：** 配置 `OPENAI_*` 后，`/documents/[id]` 对空段落 `/ai` 续写，接受前另一标签页协作者看不到新块；接受后出现。选中段落润色只改该块。拒绝后正文复原。侧边栏总结仍可用。

---

## Spec coverage

| Spec 项 | Task |
|---------|------|
| `AiBlockView` / 可写类型 | 1 |
| 校验 insert/update、禁 nested/remove | 1 |
| apply + 生成 id + canReplay | 2 |
| LangChain tools、非法跳过 | 3 |
| `POST /ai/write` SSE、限额、鉴权、零 tool error | 4 |
| 影子预览、accept/reject/stale、空段落删除 | 5 |
| `/ai`、气泡、提示条、草稿 UI | 6 |
| 工作区接入、viewer、单会话、chat 不变 | 7 |
| README | 8 |

## 计划自检

- 无 TBD；类型名在后续任务与 Task 1 一致（`AiWriteOp`、`AiWriteMode`）。
- `remove_blocks` 无实现任务，符合第一期关闭删除。
- API 只从 `/server` 导入校验层，apply 留在客户端。
